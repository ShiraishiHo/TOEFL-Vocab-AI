import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Sparkles, 
  Save, 
  Download, 
  Upload,
  Trash2, 
  ChevronRight, 
  Search,
  Loader2,
  X,
  BookOpen,
  History,
  Copy,
  Check,
  Volume2,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WordEntry, AIResponse } from './types';
import { fetchWordDetails, fetchAudio } from './services/gemini';
import { updateSM2, getDueCount } from './services/sm2';
import { Tooltip } from './components/Tooltip';

export default function App() {
  const [inputWord, setInputWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingAudio, setFetchingAudio] = useState(false);
  const [preview, setPreview] = useState<Partial<WordEntry> | null>(null);
  const [savedWords, setSavedWords] = useState<WordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const [generatingIcon, setGeneratingIcon] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Review State
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<WordEntry[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('toefl_vocab');
    if (stored) {
      try {
        setSavedWords(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored words", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('toefl_vocab', JSON.stringify(savedWords));
  }, [savedWords]);

  const handleAICompletion = async (wordToSearch?: string) => {
    const targetWord = (typeof wordToSearch === 'string' ? wordToSearch : '').trim() || inputWord.trim();
    if (!targetWord) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWordDetails(targetWord);
      
      const newEntry: Partial<WordEntry> = {
        id: crypto.randomUUID(),
        word: targetWord,
        ...data,
        createdAt: Date.now()
      };
      
      setPreview(newEntry);
      if (typeof wordToSearch === 'string') setInputWord(targetWord);
      
      // Fetch audio in background
      setFetchingAudio(true);
      try {
        const [audioUKBase64, audioUSBase64] = await Promise.all([
          fetchAudio(targetWord, 'uk'),
          fetchAudio(targetWord, 'us')
        ]);
        
        setPreview(prev => prev ? {
          ...prev,
          audioUKBase64,
          audioUSBase64
        } : null);
      } catch (audioErr) {
        console.error("Failed to fetch audio in background:", audioErr);
      } finally {
        setFetchingAudio(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch word details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!preview) return;
    setSavedWords(prev => [preview as WordEntry, ...prev]);
    setPreview(null);
    setInputWord('');
  };

  const handleDelete = (id: string) => {
    setSavedWords(prev => prev.filter(w => w.id !== id));
  };

  const exportData = (format: 'json' | 'csv') => {
    if (savedWords.length === 0) return;

    let content = '';
    let fileName = `toefl_vocab_${new Date().toISOString().split('T')[0]}`;
    let mimeType = '';

    if (format === 'json') {
      content = JSON.stringify(savedWords, null, 2);
      fileName += '.json';
      mimeType = 'application/json';
    } else {
      const headers = ['Word', 'Phonetic', 'Phonics', 'Part of Speech', 'Meaning (CN)', 'Meaning (JP)', 'English Definition', 'Examples', 'Collocations', 'Related Words', 'Etymology', 'Verb Conjugations'];
      const rows = savedWords.map(w => [
        w.word,
        w.phonetic,
        w.phonics,
        w.partOfSpeech,
        w.meaning,
        w.japaneseMeaning,
        w.englishDefinition,
        w.examples.join(' | '),
        w.collocations.join(' | '),
        w.relatedWords.join(' | '),
        w.etymology,
        w.verbConjugations ? `Past: ${w.verbConjugations.past}, PP: ${w.verbConjugations.pastParticiple}, PresP: ${w.verbConjugations.presentParticiple}, 3rd: ${w.verbConjugations.thirdPersonSingular}` : ''
      ]);
      content = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      fileName += '.csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (Array.isArray(data)) {
          // Basic validation: check if it looks like WordEntry[]
          const validData = data.filter(item => item.word && item.meaning);
          
          if (validData.length > 0) {
            setSavedWords(prev => {
              // Merge avoiding duplicates by word
              const existingWords = new Set(prev.map(w => w.word.toLowerCase()));
              const newWords = validData.filter(w => !existingWords.has(w.word.toLowerCase()));
              return [...newWords, ...prev];
            });
            alert(`Successfully imported ${validData.length} words!`);
          } else {
            alert("No valid word entries found in the file.");
          }
        } else {
          alert("Invalid file format. Expected an array of words.");
        }
      } catch (err) {
        console.error("Failed to import data:", err);
        alert("Failed to import data. Please make sure the file is a valid JSON exported from this app.");
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const copyToClipboard = (word: WordEntry | Partial<WordEntry>) => {
    let text = `${word.word} [${word.phonetic}] (${word.partOfSpeech})\nPhonics: ${word.phonics}\nCN: ${word.meaning}\nJP: ${word.japaneseMeaning}\nDefinition: ${word.englishDefinition}\n\nEtymology:\n${word.etymology}`;
    
    if (word.verbConjugations) {
      text += `\n\nConjugations:\n- Past: ${word.verbConjugations.past}\n- Past Participle: ${word.verbConjugations.pastParticiple}\n- Present Participle: ${word.verbConjugations.presentParticiple}\n- 3rd Person Singular: ${word.verbConjugations.thirdPersonSingular}`;
    }

    text += `\n\nExamples:\n${word.examples?.map(ex => `- ${ex}`).join('\n')}\n\nCollocations:\n${word.collocations?.join(', ')}\n\nRelated Words:\n${word.relatedWords?.join(', ')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(word.id || 'preview');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const playAudio = async (base64?: string) => {
    if (!base64) return;
    try {
      // iOS requires AudioContext to be created/resumed on user gesture
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 24000 });
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Decode base64 to ArrayBuffer
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Ensure alignment for Int16Array
      // If the buffer is not aligned, we need to copy it to a new aligned buffer
      let pcmData: Int16Array;
      if (bytes.byteOffset % 2 === 0) {
        pcmData = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      } else {
        const alignedBuffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(alignedBuffer).set(bytes);
        pcmData = new Int16Array(alignedBuffer);
      }

      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }

      const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
      
      // Cleanup
      source.onended = () => {
        audioContext.close();
      };
    } catch (e) {
      console.error("Playback failed", e);
    }
  };

  const startReview = () => {
    const now = Date.now();
    const due = savedWords.filter(w => !w.nextReview || w.nextReview <= now);
    if (due.length === 0) return;
    setReviewQueue(due.sort(() => Math.random() - 0.5)); // Shuffle
    setCurrentReviewIndex(0);
    setIsReviewing(true);
    setShowAnswer(false);
  };

  const handleReviewFeedback = (quality: number) => {
    const currentWord = reviewQueue[currentReviewIndex];
    const updatedWord = updateSM2(currentWord, quality);
    
    // Update savedWords
    setSavedWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
    
    if (currentReviewIndex + 1 < reviewQueue.length) {
      setCurrentReviewIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setIsReviewing(false);
      setReviewQueue([]);
    }
  };

  const dueCount = getDueCount(savedWords);

  const generateAppIcon = async () => {
    setGeneratingIcon(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: 'A professional, minimalist iOS app icon for "Vocab AI". Squircle shape. The design features a sleek, white stylized book icon with a subtle AI sparkle (star) in the corner. The background is a premium, deep Apple-blue gradient. Flat design, clean lines, high contrast, modern, academic, 1024x1024.',
            },
          ],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setAppIcon(`data:image/png;base64,${part.inlineData.data}`);
          setShowIconModal(true);
          break;
        }
      }
    } catch (err) {
      console.error("Failed to generate icon:", err);
      alert("Failed to generate icon design. Please try again.");
    } finally {
      setGeneratingIcon(false);
    }
  };

  const filteredWords = savedWords.filter(w => 
    w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.meaning.includes(searchQuery)
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          {appIcon ? (
            <img 
              src={appIcon} 
              alt="App Icon" 
              className="w-16 h-16 rounded-[1.25rem] shadow-lg border border-black/5 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setShowIconModal(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div 
              className="w-16 h-16 bg-gradient-to-br from-[#0071E3] to-[#00c6ff] rounded-[1.25rem] flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-105 transition-transform"
              onClick={generateAppIcon}
            >
              {generatingIcon ? <Loader2 size={32} className="animate-spin" /> : <Sparkles size={32} />}
            </div>
          )}
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Vocab AI</h1>
            <p className="text-[#86868B] mt-1">TOEFL Academic Word Builder</p>
          </div>
        </div>
        <div className="flex gap-3">
          {dueCount > 0 && (
            <button 
              onClick={startReview}
              className="relative apple-button-primary flex items-center gap-2 !bg-[#E30000] hover:!bg-[#C20000]"
            >
              <History size={18} />
              Start Review
              <span className="absolute -top-2 -right-2 bg-white text-[#E30000] text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[#E30000] shadow-sm">
                {dueCount}
              </span>
            </button>
          )}
          <label className="apple-button-secondary flex items-center gap-2 cursor-pointer">
            <Upload size={18} />
            Import JSON
            <input 
              type="file" 
              accept=".json" 
              onChange={importData} 
              className="hidden" 
            />
          </label>
          <button 
            onClick={() => exportData('json')}
            className="apple-button-secondary flex items-center gap-2"
            disabled={savedWords.length === 0}
          >
            <Download size={18} />
            JSON
          </button>
          <button 
            onClick={() => exportData('csv')}
            className="apple-button-secondary flex items-center gap-2"
            disabled={savedWords.length === 0}
          >
            <Download size={18} />
            CSV
          </button>
        </div>
      </header>

      {/* Input Section */}
      <section className="mb-12">
        <div className="relative flex gap-4">
          <div className="relative flex-1">
            <input 
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAICompletion()}
              placeholder="Enter a word (e.g., ephemeral)"
              className="apple-input !pl-12"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]" size={20} />
          </div>
          <button 
            onClick={() => handleAICompletion()}
            disabled={loading || !inputWord.trim()}
            className="apple-button-primary flex items-center gap-2 min-w-[140px] justify-center"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Sparkles size={20} />
                AI Complete
              </>
            )}
          </button>
        </div>
        
        {error && (
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-500 text-sm mt-3 ml-1"
          >
            {error}
          </motion.p>
        )}
      </section>

      {/* Preview Card */}
      <AnimatePresence>
        {preview && (
          <motion.section 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="mb-12"
          >
            <div className="apple-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#0071E3]" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#0071E3] mb-1 block">Preview</span>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold">{preview.word}</h2>
                    <span className="px-2 py-0.5 bg-blue-50 text-[#0071E3] text-xs font-bold rounded uppercase tracking-wider border border-blue-100">
                      {preview.partOfSpeech}
                    </span>
                    <div className="flex gap-2 items-center">
                      {preview.audioUSBase64 ? (
                        <button 
                          onClick={() => playAudio(preview.audioUSBase64!)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] text-[#0071E3] rounded-full hover:bg-[#E8E8ED] transition-all text-xs font-semibold shadow-sm"
                          title="American Pronunciation"
                        >
                          <Volume2 size={14} />
                          <span>US</span>
                        </button>
                      ) : fetchingAudio ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] text-[#86868B] rounded-full text-xs font-semibold animate-pulse">
                          <Loader2 size={14} className="animate-spin" />
                          <span>US...</span>
                        </div>
                      ) : null}
                      
                      {preview.audioUKBase64 ? (
                        <button 
                          onClick={() => playAudio(preview.audioUKBase64!)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] text-[#0071E3] rounded-full hover:bg-[#E8E8ED] transition-all text-xs font-semibold shadow-sm"
                          title="British Pronunciation"
                        >
                          <Volume2 size={14} />
                          <span>UK</span>
                        </button>
                      ) : fetchingAudio ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] text-[#86868B] rounded-full text-xs font-semibold animate-pulse">
                          <Loader2 size={14} className="animate-spin" />
                          <span>UK...</span>
                        </div>
                      ) : null}

                      {preview.audioBase64 && !preview.audioUSBase64 && !preview.audioUKBase64 && (
                        <button 
                          onClick={() => playAudio(preview.audioBase64!)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F5F5F7] text-[#0071E3] rounded-full hover:bg-[#E8E8ED] transition-all text-xs font-semibold shadow-sm"
                          title="Pronunciation"
                        >
                          <Volume2 size={14} />
                          <span>Play</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-xl text-[#86868B] font-mono">{preview.phonetic}</p>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded border border-orange-100 uppercase tracking-wider">
                      Phonics: {preview.phonics}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setPreview(null)}
                  className="apple-button-ghost"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-2">Chinese Meaning</h3>
                    <textarea 
                      value={preview.meaning}
                      onChange={(e) => setPreview({ ...preview, meaning: e.target.value })}
                      className="w-full bg-[#F5F5F7] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#0071E3] resize-none text-sm"
                      rows={2}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-2">Japanese Translation</h3>
                    <textarea 
                      value={preview.japaneseMeaning}
                      onChange={(e) => setPreview({ ...preview, japaneseMeaning: e.target.value })}
                      className="w-full bg-[#F5F5F7] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#0071E3] resize-none text-sm"
                      rows={2}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-2">English Definition</h3>
                  <textarea 
                    value={preview.englishDefinition}
                    onChange={(e) => setPreview({ ...preview, englishDefinition: e.target.value })}
                    className="w-full bg-[#F5F5F7] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#0071E3] resize-none text-sm"
                    rows={2}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-2">Morphological Analysis (Etymology)</h3>
                  <textarea 
                    value={preview.etymology}
                    onChange={(e) => setPreview({ ...preview, etymology: e.target.value })}
                    className="w-full bg-[#F5F5F7] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#0071E3] resize-none text-sm font-mono leading-relaxed"
                    rows={4}
                  />
                </div>

                {preview.verbConjugations && preview.partOfSpeech?.toLowerCase().includes('verb') && (
                  <div>
                    <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-2">Verb Conjugations</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#F5F5F7] p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-[#86868B] uppercase block mb-1">Past</span>
                        <input 
                          value={preview.verbConjugations.past}
                          onChange={(e) => setPreview({ ...preview, verbConjugations: { ...preview.verbConjugations!, past: e.target.value } })}
                          className="w-full bg-transparent text-sm font-semibold focus:outline-none"
                        />
                      </div>
                      <div className="bg-[#F5F5F7] p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-[#86868B] uppercase block mb-1">Past Part.</span>
                        <input 
                          value={preview.verbConjugations.pastParticiple}
                          onChange={(e) => setPreview({ ...preview, verbConjugations: { ...preview.verbConjugations!, pastParticiple: e.target.value } })}
                          className="w-full bg-transparent text-sm font-semibold focus:outline-none"
                        />
                      </div>
                      <div className="bg-[#F5F5F7] p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-[#86868B] uppercase block mb-1">Pres. Part.</span>
                        <input 
                          value={preview.verbConjugations.presentParticiple}
                          onChange={(e) => setPreview({ ...preview, verbConjugations: { ...preview.verbConjugations!, presentParticiple: e.target.value } })}
                          className="w-full bg-transparent text-sm font-semibold focus:outline-none"
                        />
                      </div>
                      <div className="bg-[#F5F5F7] p-3 rounded-xl">
                        <span className="text-[10px] font-bold text-[#86868B] uppercase block mb-1">3rd Person</span>
                        <input 
                          value={preview.verbConjugations.thirdPersonSingular}
                          onChange={(e) => setPreview({ ...preview, verbConjugations: { ...preview.verbConjugations!, thirdPersonSingular: e.target.value } })}
                          className="w-full bg-transparent text-sm font-semibold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-2">Related Words (Click to search)</h3>
                  <div className="flex flex-wrap gap-2">
                    {preview.relatedWords?.map((rel, i) => (
                      <button 
                        key={i}
                        onClick={() => handleAICompletion(rel)}
                        className="px-3 py-1.5 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#0071E3] text-sm rounded-full transition-all border border-transparent hover:border-[#0071E3]/20"
                      >
                        {rel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-3">TOEFL Examples</h3>
                    <div className="space-y-3">
                      {preview.examples?.map((ex, i) => (
                        <textarea 
                          key={i}
                          value={ex}
                          onChange={(e) => {
                            const newEx = [...(preview.examples || [])];
                            newEx[i] = e.target.value;
                            setPreview({ ...preview, examples: newEx });
                          }}
                          className="w-full text-sm bg-[#F5F5F7] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#0071E3] resize-none"
                          rows={2}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-3">Academic Collocations</h3>
                    <div className="space-y-3">
                      {preview.collocations?.map((col, i) => (
                        <input 
                          key={i}
                          value={col}
                          onChange={(e) => {
                            const newCol = [...(preview.collocations || [])];
                            newCol[i] = e.target.value;
                            setPreview({ ...preview, collocations: newCol });
                          }}
                          className="w-full text-sm bg-[#F5F5F7] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    onClick={() => copyToClipboard(preview)}
                    className="apple-button-secondary flex items-center gap-2"
                  >
                    {copiedId === 'preview' ? <Check size={20} /> : <Copy size={20} />}
                    {copiedId === 'preview' ? 'Copied' : 'Copy'}
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={fetchingAudio}
                    className="apple-button-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {fetchingAudio ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Save size={20} />
                    )}
                    {fetchingAudio ? 'Fetching Audio...' : 'Save to List'}
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Saved List */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <History size={20} className="text-[#86868B]" />
            <h2 className="text-xl font-semibold">Saved Words ({savedWords.length})</h2>
          </div>
          <div className="relative w-64">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search list..."
              className="w-full bg-[#F5F5F7] border-none rounded-lg px-3 py-2 !pl-10 text-sm focus:ring-1 focus:ring-[#0071E3]"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" size={14} />
          </div>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredWords.map((word) => (
              <motion.div 
                key={word.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="apple-card p-6 group hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex flex-col mb-3">
                      <div className="flex items-center gap-3">
                        <Tooltip content={
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-[#1D1D1F]">{word.word}</p>
                              <span className="text-[10px] font-bold text-[#0071E3] uppercase">{word.partOfSpeech}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-[#86868B] font-mono">{word.phonetic}</p>
                              <span className="text-[9px] text-orange-600 font-bold bg-orange-50 px-1 rounded border border-orange-100 uppercase">{word.phonics}</span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-[#424245] leading-tight"><span className="font-bold">CN:</span> {word.meaning}</p>
                              <p className="text-xs text-[#424245] leading-tight"><span className="font-bold">JP:</span> {word.japaneseMeaning}</p>
                            </div>
                            <p className="text-xs text-[#86868B] italic leading-tight border-t border-[#E5E5E7] pt-1">{word.englishDefinition}</p>
                          </div>
                        }>
                          <h3 className="text-xl font-bold cursor-help border-b border-dotted border-[#D2D2D7] hover:border-[#0071E3] transition-colors">
                            {word.word}
                          </h3>
                        </Tooltip>
                        <span className="text-[10px] font-bold text-[#0071E3] uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {word.partOfSpeech}
                        </span>
                        <div className="flex gap-1 items-center">
                          {word.audioUSBase64 && (
                            <button 
                              onClick={() => playAudio(word.audioUSBase64!)}
                              className="p-1.5 text-[#0071E3] hover:bg-blue-50 rounded-full transition-all flex items-center gap-1"
                              title="US Pronunciation"
                            >
                              <Volume2 size={14} />
                              <span className="text-[10px] font-bold">US</span>
                            </button>
                          )}
                          {word.audioUKBase64 && (
                            <button 
                              onClick={() => playAudio(word.audioUKBase64!)}
                              className="p-1.5 text-[#0071E3] hover:bg-blue-50 rounded-full transition-all flex items-center gap-1"
                              title="UK Pronunciation"
                            >
                              <Volume2 size={14} />
                              <span className="text-[10px] font-bold">UK</span>
                            </button>
                          )}
                          {word.audioBase64 && !word.audioUSBase64 && !word.audioUKBase64 && (
                            <button 
                              onClick={() => playAudio(word.audioBase64!)}
                              className="p-1.5 text-[#0071E3] hover:bg-blue-50 rounded-full transition-all flex items-center gap-1"
                              title="Pronunciation"
                            >
                              <Volume2 size={14} />
                              <span className="text-[10px] font-bold">Play</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[#86868B] font-mono text-sm">{word.phonetic}</span>
                        <div className="flex items-center gap-2 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[9px] font-bold rounded border border-orange-100 uppercase tracking-wider">
                          Phonics: {word.phonics}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] block mb-1">Meanings</span>
                        <div className="space-y-1">
                          <p className="text-sm text-[#1D1D1F]"><span className="text-[#86868B] font-medium mr-1">CN:</span>{word.meaning}</p>
                          <p className="text-sm text-[#1D1D1F]"><span className="text-[#86868B] font-medium mr-1">JP:</span>{word.japaneseMeaning}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] block mb-1">Definition</span>
                        <p className="text-sm text-[#424245] leading-relaxed">{word.englishDefinition}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] block mb-1">Morphological Analysis</span>
                      <p className="text-sm text-[#424245] leading-relaxed whitespace-pre-wrap font-mono bg-[#F5F5F7] p-3 rounded-lg border border-[#E5E5E7]">
                        {word.etymology}
                      </p>
                    </div>

                    {word.verbConjugations && word.partOfSpeech.toLowerCase().includes('verb') && (
                      <div className="mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] block mb-2">Verb Conjugations</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="bg-[#F5F5F7] px-3 py-2 rounded-lg border border-[#E5E5E7]">
                            <span className="text-[8px] font-bold text-[#86868B] uppercase block">Past</span>
                            <span className="text-xs font-semibold">{word.verbConjugations.past}</span>
                          </div>
                          <div className="bg-[#F5F5F7] px-3 py-2 rounded-lg border border-[#E5E5E7]">
                            <span className="text-[8px] font-bold text-[#86868B] uppercase block">Past Part.</span>
                            <span className="text-xs font-semibold">{word.verbConjugations.pastParticiple}</span>
                          </div>
                          <div className="bg-[#F5F5F7] px-3 py-2 rounded-lg border border-[#E5E5E7]">
                            <span className="text-[8px] font-bold text-[#86868B] uppercase block">Pres. Part.</span>
                            <span className="text-xs font-semibold">{word.verbConjugations.presentParticiple}</span>
                          </div>
                          <div className="bg-[#F5F5F7] px-3 py-2 rounded-lg border border-[#E5E5E7]">
                            <span className="text-[8px] font-bold text-[#86868B] uppercase block">3rd Person</span>
                            <span className="text-xs font-semibold">{word.verbConjugations.thirdPersonSingular}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] block mb-2">Related Words</span>
                      <div className="flex flex-wrap gap-2">
                        {word.relatedWords.map((rel, i) => (
                          <button 
                            key={i}
                            onClick={() => handleAICompletion(rel)}
                            className="text-xs text-[#0071E3] bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-all border border-blue-100"
                          >
                            {rel}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B]">Examples</span>
                        {word.examples.map((ex, i) => (
                          <p key={i} className="text-sm text-[#424245] leading-relaxed italic">
                            "{ex}"
                          </p>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868B]">Collocations</span>
                        <div className="flex flex-wrap gap-2">
                          {word.collocations.map((col, i) => (
                            <span key={i} className="text-xs bg-[#F5F5F7] text-[#424245] px-2 py-1 rounded-md">
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => copyToClipboard(word)}
                      className="text-[#0071E3] p-2 hover:bg-blue-50 rounded-lg transition-all"
                      title="Copy to clipboard"
                    >
                      {copiedId === word.id ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <button 
                      onClick={() => handleDelete(word.id)}
                      className="text-[#E30000] p-2 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete word"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {savedWords.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#D2D2D7]">
              <BookOpen size={48} className="mx-auto text-[#D2D2D7] mb-4" />
              <p className="text-[#86868B]">No words saved yet. Start by entering a word above.</p>
            </div>
          )}
          
          {savedWords.length > 0 && filteredWords.length === 0 && (
            <p className="text-center py-10 text-[#86868B]">No matches found for "{searchQuery}"</p>
          )}
        </div>
      </section>
      {/* Review Modal */}
      <AnimatePresence>
        {isReviewing && reviewQueue[currentReviewIndex] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden relative"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <History size={20} className="text-[#E30000]" />
                    <span className="text-sm font-semibold text-[#86868B] uppercase tracking-widest">
                      Reviewing {currentReviewIndex + 1} / {reviewQueue.length}
                    </span>
                  </div>
                  <button onClick={() => setIsReviewing(false)} className="p-2 hover:bg-[#F5F5F7] rounded-full transition-all">
                    <X size={20} className="text-[#86868B]" />
                  </button>
                </div>

                <div className="text-center mb-12">
                  <h2 className="text-5xl font-bold mb-4">{reviewQueue[currentReviewIndex].word}</h2>
                  <div className="flex justify-center gap-2">
                    {reviewQueue[currentReviewIndex].audioUSBase64 && (
                      <button 
                        onClick={() => playAudio(reviewQueue[currentReviewIndex].audioUSBase64)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#F5F5F7] text-[#0071E3] rounded-full text-xs font-bold hover:bg-[#E8E8ED] transition-all"
                      >
                        <Volume2 size={14} /> US
                      </button>
                    )}
                    {reviewQueue[currentReviewIndex].audioUKBase64 && (
                      <button 
                        onClick={() => playAudio(reviewQueue[currentReviewIndex].audioUKBase64)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#F5F5F7] text-[#0071E3] rounded-full text-xs font-bold hover:bg-[#E8E8ED] transition-all"
                      >
                        <Volume2 size={14} /> UK
                      </button>
                    )}
                    {reviewQueue[currentReviewIndex].audioBase64 && !reviewQueue[currentReviewIndex].audioUSBase64 && !reviewQueue[currentReviewIndex].audioUKBase64 && (
                      <button 
                        onClick={() => playAudio(reviewQueue[currentReviewIndex].audioBase64)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#F5F5F7] text-[#0071E3] rounded-full text-xs font-bold hover:bg-[#E8E8ED] transition-all"
                      >
                        <Volume2 size={14} /> Play
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {!showAnswer ? (
                    <motion.div 
                      key="question"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex justify-center"
                    >
                      <button 
                        onClick={() => setShowAnswer(true)}
                        className="apple-button-primary w-full py-4 text-lg"
                      >
                        Show Answer
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="answer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="bg-[#F5F5F7] p-6 rounded-2xl space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-[#0071E3]">{reviewQueue[currentReviewIndex].phonetic}</span>
                          <span className="text-xs font-bold uppercase tracking-widest text-[#86868B]">{reviewQueue[currentReviewIndex].partOfSpeech}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <p className="text-sm"><span className="font-bold text-[#86868B] mr-1">CN:</span> {reviewQueue[currentReviewIndex].meaning}</p>
                          <p className="text-sm"><span className="font-bold text-[#86868B] mr-1">JP:</span> {reviewQueue[currentReviewIndex].japaneseMeaning}</p>
                        </div>
                        <p className="text-sm text-[#424245] italic leading-relaxed">"{reviewQueue[currentReviewIndex].examples[0]}"</p>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Forgot', value: 0, color: 'bg-red-500' },
                          { label: 'Hard', value: 1, color: 'bg-orange-500' },
                          { label: 'Good', value: 2, color: 'bg-blue-500' },
                          { label: 'Easy', value: 3, color: 'bg-green-500' },
                        ].map((btn) => (
                          <button
                            key={btn.value}
                            onClick={() => handleReviewFeedback(btn.value)}
                            className={`flex flex-col items-center gap-1 py-3 rounded-xl text-white font-bold transition-transform active:scale-95 ${btn.color}`}
                          >
                            <span className="text-xs uppercase tracking-tighter">{btn.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Icon Design Modal */}
        <AnimatePresence>
          {showIconModal && appIcon && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowIconModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl text-center"
                onClick={e => e.stopPropagation()}
              >
                <div className="mb-8 flex justify-center">
                  <img 
                    src={appIcon} 
                    alt="App Icon Design" 
                    className="w-48 h-48 rounded-[2.5rem] shadow-2xl border border-black/5"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h2 className="text-2xl font-bold mb-2">App Icon Design</h2>
                <p className="text-[#86868B] mb-8 text-sm">
                  A minimalist Apple-style design featuring a clean book symbol and AI sparkles on a premium blue gradient.
                </p>
                <div className="flex flex-col gap-3">
                  <a 
                    href={appIcon} 
                    download="vocab-ai-icon.png"
                    className="apple-button-primary w-full py-3 flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    Download Icon
                  </a>
                  <button 
                    onClick={generateAppIcon}
                    className="apple-button-secondary w-full py-3 flex items-center justify-center gap-2"
                    disabled={generatingIcon}
                  >
                    <Palette size={18} />
                    {generatingIcon ? "Designing..." : "Redesign Icon"}
                  </button>
                  <button 
                    onClick={() => setShowIconModal(false)}
                    className="text-[#86868B] text-sm font-medium hover:text-[#1D1D1F] transition-colors mt-2"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
}
