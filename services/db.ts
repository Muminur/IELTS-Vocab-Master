import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  limit,
  deleteDoc
} from "firebase/firestore";
import { WordDetails, StoredWord } from "../types";

// Spaced Repetition Intervals in days
const SRS_INTERVALS = [1, 3, 7, 14, 30, 90];
const LOCAL_STORAGE_PREFIX = 'vocab_master_data_';

// --- Local Storage Helpers ---

// Mimic Firestore Timestamp behavior for local objects
const createFakeTimestamp = (date: Date | string) => {
    const d = new Date(date);
    return {
        toDate: () => d,
        seconds: Math.floor(d.getTime() / 1000),
        nanoseconds: 0
    };
};

// Convert Word object to JSON-safe structure (Dates to ISO strings)
const serializeWord = (word: any) => {
    return {
        ...word,
        createdAt: word.createdAt?.toDate ? word.createdAt.toDate().toISOString() : (new Date().toISOString()),
        nextReviewAt: word.nextReviewAt?.toDate ? word.nextReviewAt.toDate().toISOString() : (new Date().toISOString()),
        lastReviewedAt: word.lastReviewedAt?.toDate ? word.lastReviewedAt.toDate().toISOString() : null,
    };
};

// Convert JSON-safe structure back to Word object (ISO strings to FakeTimestamps)
const deserializeWords = (json: string): StoredWord[] => {
    try {
        const data = JSON.parse(json);
        if (!Array.isArray(data)) return [];
        return data.map((w: any) => ({
            ...w,
            createdAt: createFakeTimestamp(w.createdAt),
            nextReviewAt: createFakeTimestamp(w.nextReviewAt),
            lastReviewedAt: w.lastReviewedAt ? createFakeTimestamp(w.lastReviewedAt) : undefined
        }));
    } catch (e) {
        return [];
    }
};

// --- Main Service Functions ---

export const verifyDbConnection = async (userId: string) => {
  const logs: string[] = [];
  try {
    // 1. Check Read Access
    logs.push("🔍 Checking Read Access...");
    const q = query(collection(db, `users/${userId}/words`), limit(1));
    await getDocs(q);
    logs.push("✅ Read Access: OK");

    // 2. Check Write Access
    logs.push("📝 Checking Write Access...");
    // Create a robust dummy object so if delete fails, it doesn't crash the app
    const testDocData = {
        word: '_CONNECTION_TEST_',
        ipa: '/test/',
        partOfSpeech: 'test',
        definition: 'Temporary connectivity test',
        example: 'Test sentence',
        collocations: [],
        synonyms: [],
        antonyms: [],
        userId,
        createdAt: new Date(),
        nextReviewAt: new Date(),
        srsStage: 0,
        isTest: true
    };
    
    const docRef = await addDoc(collection(db, `users/${userId}/words`), testDocData);
    logs.push("✅ Write Access: OK");

    // 3. Cleanup (Delete the test doc)
    logs.push("🧹 Cleaning up test data...");
    await deleteDoc(docRef);
    logs.push("✅ Cleanup: OK");

    return { 
        success: true, 
        message: `Database Connection Successful!\n\n${logs.join('\n')}` 
    };

  } catch (error: any) {
    console.error("Verification Error", error);
    
    let advice = "";
    if (error.code === 'permission-denied') {
        advice = "Permission Denied. Please check your Firestore Security Rules to ensure users can read/write to 'users/{userId}/words'.";
    } else if (error.code === 'unavailable') {
        advice = "Service Unavailable. You might be offline or the client cannot reach Firestore.";
    } else {
        advice = error.message;
    }

    return { 
        success: false, 
        message: `❌ Database Connection Failed\n\nLog:\n${logs.join('\n')}\n\nError: ${advice}` 
    };
  }
};

export const saveWordToProfile = async (userId: string, wordData: WordDetails) => {
  try {
    // 1. Try Firestore
    // Check if word exists
    const q = query(
      collection(db, `users/${userId}/words`),
      where("word", "==", wordData.word)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      throw new Error("You have already saved this word.");
    }

    // Use native Date objects; Firestore SDK converts them to Timestamps automatically
    const newWord = {
      ...wordData,
      userId,
      createdAt: new Date(),
      nextReviewAt: new Date(),
      srsStage: 0,
      isInFFL: false,
    };

    await addDoc(collection(db, `users/${userId}/words`), newWord);
    return true;

  } catch (error: any) {
    // 2. Fallback to LocalStorage
    // We catch permissions, unavailable (offline), not-found (DB not created), and failed-precondition
    const isFirestoreError = error.code === 'permission-denied' || 
                             error.code === 'unavailable' || 
                             error.code === 'failed-precondition' || 
                             error.code === 'not-found' ||
                             (error.message && error.message.includes("permissions"));

    if (isFirestoreError) {
        console.warn(`Firestore write failed (${error.code}), falling back to LocalStorage.`);
        
        const localData = localStorage.getItem(LOCAL_STORAGE_PREFIX + userId);
        const words = deserializeWords(localData || '[]');
        
        if (words.some(w => w.word === wordData.word)) {
             throw new Error("You have already saved this word.");
        }

        const newLocalWord: StoredWord = {
            id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            ...wordData,
            createdAt: createFakeTimestamp(new Date()),
            nextReviewAt: createFakeTimestamp(new Date()),
            srsStage: 0,
            isInFFL: false
        };

        const updatedList = [...words, newLocalWord].map(serializeWord);
        localStorage.setItem(LOCAL_STORAGE_PREFIX + userId, JSON.stringify(updatedList));
        return true;
    }
    // Re-throw if it's "Already saved" or some other logic error
    throw error;
  }
};

export const getUserWords = async (userId: string): Promise<StoredWord[]> => {
  try {
    const q = query(collection(db, `users/${userId}/words`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as StoredWord));
  } catch (error: any) {
    // Fallback read
    console.warn("Firestore read failed, checking LocalStorage.", error.code);
    const localData = localStorage.getItem(LOCAL_STORAGE_PREFIX + userId);
    return deserializeWords(localData || '[]');
  }
};

export const getDueWords = async (userId: string): Promise<StoredWord[]> => {
  try {
    const now = new Date();
    // Use getUserWords which handles the fallback internally
    const allWords = await getUserWords(userId);
    
    return allWords.filter(word => {
      if (!word.nextReviewAt) return true;
      
      // Handle both Firestore Timestamp (has toDate) and our FakeTimestamp (has toDate)
      const reviewDate = typeof word.nextReviewAt.toDate === 'function' 
        ? word.nextReviewAt.toDate() 
        : new Date(word.nextReviewAt);

      return reviewDate <= now;
    });
  } catch (error) {
    console.error("Error fetching due words:", error);
    return [];
  }
};

export const getFFLWords = async (userId: string): Promise<StoredWord[]> => {
    const allWords = await getUserWords(userId);
    return allWords.filter(w => w.isInFFL === true);
};

export const markWordAsForgot = async (userId: string, wordId: string) => {
    try {
        if (wordId.startsWith('local_')) {
            throw new Error("Local ID");
        }
        const wordRef = doc(db, `users/${userId}/words`, wordId);
        await updateDoc(wordRef, { isInFFL: true });
    } catch (error) {
        // Local storage fallback
        const localData = localStorage.getItem(LOCAL_STORAGE_PREFIX + userId);
        let words = deserializeWords(localData || '[]');
        const idx = words.findIndex(w => w.id === wordId);
        if (idx !== -1) {
            words[idx].isInFFL = true;
            localStorage.setItem(LOCAL_STORAGE_PREFIX + userId, JSON.stringify(words.map(serializeWord)));
        }
    }
};

export const updateWordProgress = async (userId: string, wordId: string, isCorrect: boolean, currentStage: number) => {
  let newStage = currentStage;
  let nextReviewDate = new Date();

  if (isCorrect) {
    newStage = Math.min(currentStage + 1, SRS_INTERVALS.length);
    const daysToAdd = SRS_INTERVALS[Math.min(newStage - 1, SRS_INTERVALS.length - 1)] || 1;
    nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);
  } else {
    newStage = Math.max(0, currentStage - 1);
    nextReviewDate.setDate(nextReviewDate.getDate() + 0); 
  }

  try {
    // If ID starts with 'local_', skip Firestore and throw to catch block
    if (wordId.startsWith('local_')) {
        throw new Error("Local ID, triggering fallback");
    }

    const wordRef = doc(db, `users/${userId}/words`, wordId);
    await updateDoc(wordRef, {
      srsStage: newStage,
      nextReviewAt: nextReviewDate, // Pass native Date
      lastReviewedAt: serverTimestamp()
    });
  } catch (error: any) {
    // Fallback Update
    if (wordId.startsWith('local_') || error.code) {
         const localData = localStorage.getItem(LOCAL_STORAGE_PREFIX + userId);
         let words = deserializeWords(localData || '[]');
         
         const idx = words.findIndex(w => w.id === wordId);
         if (idx !== -1) {
             words[idx].srsStage = newStage;
             words[idx].nextReviewAt = createFakeTimestamp(nextReviewDate);
             words[idx].lastReviewedAt = createFakeTimestamp(new Date());
             
             localStorage.setItem(LOCAL_STORAGE_PREFIX + userId, JSON.stringify(words.map(serializeWord)));
         }
    } else {
        console.error("Error updating word progress:", error);
    }
  }
};