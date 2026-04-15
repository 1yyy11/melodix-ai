import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Wand2, Play, Music4, Settings2 } from "lucide-react";
import { useGenerateTrack, type GenerationParams } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { usePlayer } from "@/hooks/use-player";
import { formatTime } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";

const GENRES = ["Electronic", "Pop", "Rock", "Hip-hop", "Classical", "Ambient", "Jazz", "Lo-Fi"];
const MOODS = ["Happy", "Sad", "Energetic", "Calm", "Dramatic", "Mysterious", "Aggressive", "Chill"];
const INSTRUMENTS = ["Synthesizer", "Piano", "Electric Guitar", "Acoustic Guitar", "Drums", "Bass", "Strings", "Vocals"];

// Переводы для жанров
const GENRES_RU: Record<string, string> = {
  "Electronic": "Электроника",
  "Pop": "Поп",
  "Rock": "Рок",
  "Hip-hop": "Хип-хоп",
  "Classical": "Классика",
  "Ambient": "Эмбиент",
  "Jazz": "Джаз",
  "Lo-Fi": "Lo-Fi"
};

// Переводы для настроений
const MOODS_RU: Record<string, string> = {
  "Happy": "Счастливое",
  "Sad": "Грустное",
  "Energetic": "Энергичное",
  "Calm": "Спокойное",
  "Dramatic": "Драматичное",
  "Mysterious": "Таинственное",
  "Aggressive": "Агрессивное",
  "Chill": "Расслабленное"
};

// Переводы для инструментов
const INSTRUMENTS_RU: Record<string, string> = {
  "Synthesizer": "Синтезатор",
  "Piano": "Пианино",
  "Electric Guitar": "Электрогитара",
  "Acoustic Guitar": "Акустическая гитара",
  "Drums": "Ударные",
  "Bass": "Бас",
  "Strings": "Струнные",
  "Vocals": "Вокал"
};

export default function Generate() {
  const { toast } = useToast();
  const { playTrack } = usePlayer();
  const { isAuthenticated, login } = useAuth();
  const generateMutation = useGenerateTrack();

  const [form, setForm] = useState<GenerationParams>({
    genre: "Electronic",
    mood: "Energetic",
    tempo: 120,
    duration: 30,
    prompt: "",
    instruments: ["Synthesizer", "Drums"]
  });

  const [generatedTrack, setGeneratedTrack] = useState<any>(null);

  const handleGenerate = () => {
    if (!isAuthenticated) {
      toast({ title: "Требуется авторизация", description: "Пожалуйста, войдите для генерации музыки." });
      login();
      return;
    }

    if (!form.prompt?.trim() && !form.genre) {
      toast({ title: "Необходим ввод", description: "Пожалуйста, укажите описание или выберите жанр.", variant: "destructive" });
      return;
    }

    setGeneratedTrack(null);
    generateMutation.mutate({ data: form }, {
      onSuccess: (data) => {
        setGeneratedTrack(data.track);
        toast({ title: "Трек создан!", description: "Ваш новый трек готов к воспроизведению." });
      },
      onError: (err) => {
        toast({ title: "Ошибка генерации", description: err.message, variant: "destructive" });
      }
    });
  };

  const toggleInstrument = (inst: string) => {
    const current = form.instruments || [];
    if (current.includes(inst)) {
      setForm({ ...form, instruments: current.filter(i => i !== inst) });
    } else {
      setForm({ ...form, instruments: [...current, inst] });
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12 pb-20">
        
        {/* Left Column - Controls */}
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-4xl font-display font-bold flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              Генератор
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">Задайте параметры, и ИИ создаст ваш трек.</p>
          </div>

          <div className="glass-card p-6 md:p-8 rounded-3xl space-y-8">
            
            {/* Prompt */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Творческое описание (необязательно)</Label>
              <Textarea 
                placeholder="Например: Сцена погони в киберпанк-стиле под дождём в неоновом городе..."
                className="resize-none h-24 bg-background border-border/50 focus:border-primary focus:ring-primary/20 text-base"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Genre */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Жанр</Label>
                <Select value={form.genre} onValueChange={(v) => setForm({ ...form, genre: v })}>
                  <SelectTrigger className="h-12 bg-background border-border/50">
                    <SelectValue placeholder="Выберите жанр" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map(g => <SelectItem key={g} value={g}>{GENRES_RU[g] || g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Mood */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Настроение</Label>
                <Select value={form.mood} onValueChange={(v) => setForm({ ...form, mood: v })}>
                  <SelectTrigger className="h-12 bg-background border-border/50">
                    <SelectValue placeholder="Выберите настроение" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOODS.map(m => <SelectItem key={m} value={m}>{MOODS_RU[m] || m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-8 pt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" /> Темп (BPM)
                  </Label>
                  <span className="font-mono text-sm bg-secondary px-2 py-1 rounded-md">{form.tempo}</span>
                </div>
                <Slider 
                  min={60} max={180} step={1} 
                  value={[form.tempo]} 
                  onValueChange={(v) => setForm({ ...form, tempo: v[0] })}
                  className="py-4"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Длительность
                  </Label>
                  <span className="font-mono text-sm bg-secondary px-2 py-1 rounded-md">{form.duration} сек</span>
                </div>
                <Slider 
                  min={10} max={300} step={10} 
                  value={[form.duration]} 
                  onValueChange={(v) => setForm({ ...form, duration: v[0] })}
                  className="py-4"
                />
              </div>
            </div>

            {/* Instruments */}
            <div className="space-y-4 pt-2">
              <Label className="text-base font-semibold">Инструменты</Label>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map(inst => (
                  <button
                    key={inst}
                    onClick={() => toggleInstrument(inst)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                      form.instruments?.includes(inst) 
                        ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(233,105,168,0.2)]' 
                        : 'bg-background border-border/50 text-muted-foreground hover:border-border hover:bg-secondary'
                    }`}
                  >
                    {INSTRUMENTS_RU[inst] || inst}
                  </button>
                ))}
              </div>
            </div>

            <Button 
              className="w-full h-14 text-lg rounded-xl font-bold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-1 mt-4"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <span className="flex items-center gap-2 animate-pulse">
                  <Wand2 className="w-5 h-5 animate-spin" /> Создание аудио...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" /> Создать трек
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col">
          <div className="sticky top-28 space-y-6">
            <h3 className="font-display font-bold text-2xl">Результат</h3>
            
            <div className="glass-card rounded-3xl p-6 min-h-[400px] flex flex-col items-center justify-center text-center relative overflow-hidden border border-border/50">
              
              <AnimatePresence mode="wait">
                {generateMutation.isPending ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center w-full h-full space-y-6 z-10"
                  >
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                    <div className="space-y-2">
                      <p className="font-bold text-lg animate-pulse">Создание мелодии...</p>
                      <p className="text-sm text-muted-foreground">Применяю стиль {GENRES_RU[form.genre] || form.genre} с {MOODS_RU[form.mood]?.toLowerCase() || form.mood} настроением</p>
                    </div>
                  </motion.div>
                ) : generatedTrack ? (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="w-full flex flex-col items-center z-10"
                  >
                    <div className="w-full aspect-square rounded-2xl bg-secondary mb-6 shadow-2xl relative group overflow-hidden border border-border/50">
                      {generatedTrack.coverUrl ? (
                        <img src={generatedTrack.coverUrl} alt="Обложка" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                          <Music4 className="w-16 h-16 text-primary/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <Button size="icon" className="w-16 h-16 rounded-full bg-primary hover:scale-110 transition-transform shadow-xl shadow-primary/30" onClick={() => playTrack(generatedTrack)}>
                          <Play className="w-8 h-8 ml-1" />
                        </Button>
                      </div>
                    </div>
                    <h4 className="font-bold text-xl text-foreground mb-1 w-full truncate">{generatedTrack.title}</h4>
                    <p className="text-primary text-sm font-medium w-full truncate">{GENRES_RU[generatedTrack.genre] || generatedTrack.genre} • {MOODS_RU[generatedTrack.mood] || generatedTrack.mood}</p>
                    
                    <div className="flex gap-3 mt-6 w-full">
                      <Button className="flex-1 rounded-xl" onClick={() => playTrack(generatedTrack)}>Воспроизвести</Button>
                      <Button variant="outline" className="flex-1 rounded-xl">Сохранить</Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center text-muted-foreground z-10"
                  >
                    <div className="w-20 h-20 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4 rotate-12">
                      <Music4 className="w-10 h-10 text-muted-foreground/50 -rotate-12" />
                    </div>
                    <p className="max-w-[200px]">Здесь появится ваш сгенерированный трек.</p>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Decorative background glow for result box */}
              {generatedTrack && (
                <div className="absolute inset-0 bg-primary/5 mix-blend-overlay z-0"></div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}

// Utility component used above
function Clock({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}