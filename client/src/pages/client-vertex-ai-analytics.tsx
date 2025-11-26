import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Menu } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

const VertexAnalyticsDashboard = lazy(() => import('@/components/vertex-analytics-dashboard'));

export default function ClientVertexAIAnalytics() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/client/sales-agents')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Sales Agents
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Vertex AI Analytics
              </h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Suspense 
                fallback={
                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-12 text-center">
                      <Sparkles className="h-16 w-16 mx-auto mb-4 text-purple-400 animate-pulse" />
                      <p className="text-gray-600 dark:text-gray-400">Caricamento analytics Vertex AI...</p>
                    </CardContent>
                  </Card>
                }
              >
                <VertexAnalyticsDashboard />
              </Suspense>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
