import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TrackCard } from '@/components/tracks/track-card';
import { Loader2 } from 'lucide-react';

interface Recommendation {
    id: number;
    track_id: string;
    score: number;
    reason: string;
    title: string;
    artist_name: string;
    genre: string;
    mood: string;
    tempo: number;
    duration: number;
    cover_url: string;
}

export function RecommendationsSection() {
    const { token } = useAuth();
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRecommendations();
    }, [token]);

    const fetchRecommendations = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/recommendations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setRecommendations(data);
            }
        } catch (error) {
            console.error('Error fetching recommendations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (recommendations.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-400">Послушайте несколько треков, чтобы получить персональные рекомендации</p>
            </div>
        );
    }

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">🎯 Рекомендовано для вас</h2>
                <span className="text-xs text-gray-400">На основе ваших предпочтений</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {recommendations.slice(0, 10).map((rec) => (
                    <div key={rec.track_id} className="relative group">
                        <TrackCard 
                            track={{
                                id: rec.track_id,
                                title: rec.title,
                                artist: rec.artist_name,
                                genre: rec.genre,
                                mood: rec.mood,
                                tempo: rec.tempo,
                                duration: rec.duration,
                                coverUrl: rec.cover_url
                            }}
                        />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs text-primary">
                            {rec.reason}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}