import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Target, Award } from "lucide-react";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { motion } from "framer-motion";

interface UserBadge {
  id: string;
  userId: string;
  badgeType: string;
  badgeName: string;
  badgeDescription: string;
  earnedAt: Date;
}

interface BadgeDisplayProps {
  userId?: string;
  compact?: boolean;
}

const getBadgeIcon = (badgeType: string) => {
  // Achievement badges (🏆)
  if (["prima_lezione", "primo_trimestre", "anno_completato", "perfezionista", "velocista"].includes(badgeType)) {
    return <Trophy className="h-6 w-6 text-amber-500" />;
  }
  // Milestone badges (⭐)
  if (["esperto", "mentor", "master"].includes(badgeType)) {
    return <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />;
  }
  // Goal badges (🎯)
  return <Target className="h-6 w-6 text-blue-500" />;
};

const getBadgeColor = (badgeType: string) => {
  if (["prima_lezione", "primo_trimestre", "anno_completato", "perfezionista", "velocista"].includes(badgeType)) {
    return "from-amber-500 to-yellow-500";
  }
  if (["esperto", "mentor", "master"].includes(badgeType)) {
    return "from-yellow-400 to-orange-500";
  }
  return "from-blue-500 to-indigo-500";
};

export default function BadgeDisplay({ userId, compact = false }: BadgeDisplayProps) {
  const user = getAuthUser();
  const targetUserId = userId || user?.id;

  const { data: badges = [], isLoading } = useQuery<UserBadge[]>({
    queryKey: ["/api/badges", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const response = await fetch(`/api/badges/${targetUserId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch badges");
      return response.json();
    },
    enabled: !!targetUserId,
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            I Miei Badge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Caricamento...</div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap">
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun badge ottenuto ancora</p>
        ) : (
          badges.slice(0, 5).map((badge, index) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <div
                className={`p-3 rounded-xl bg-gradient-to-br ${getBadgeColor(badge.badgeType)} shadow-lg`}
                title={badge.badgeDescription}
              >
                {getBadgeIcon(badge.badgeType)}
              </div>
            </motion.div>
          ))
        )}
        {badges.length > 5 && (
          <div className="p-3 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-sm font-semibold">+{badges.length - 5}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          I Miei Badge ({badges.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500/10 to-pink-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              Completa le lezioni per ottenere i tuoi primi badge!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {badges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="group relative">
                  <div
                    className={`p-4 rounded-xl bg-gradient-to-br ${getBadgeColor(
                      badge.badgeType
                    )} shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {getBadgeIcon(badge.badgeType)}
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">{badge.badgeName}</p>
                        <p className="text-xs text-white/80 mt-1">{badge.badgeDescription}</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <Badge className="bg-white text-xs px-2 py-0.5 shadow-sm">
                      {new Date(badge.earnedAt).toLocaleDateString('it-IT', { 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
