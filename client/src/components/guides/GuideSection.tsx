import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";

interface GuideSectionProps {
  icon: ReactNode;
  title: string;
  description: string;
  steps: Array<{
    title: string;
    content: string;
    actionText?: string;
    actionHref?: string;
  }>;
}

export function GuideSection({ icon, title, description, steps }: GuideSectionProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-lg">
            {icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                {index + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {step.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {step.content}
                </p>
                {step.actionText && step.actionHref && (
                  <Link href={step.actionHref}>
                    <Button variant="link" size="sm" className="p-0 h-auto text-blue-600 dark:text-blue-400">
                      {step.actionText}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
