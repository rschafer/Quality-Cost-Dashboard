"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ResolutionTypePie from "@/components/charts/ResolutionTypePie";
import ModuleDistribution from "@/components/charts/ModuleDistribution";

interface DashboardChartsProps {
  resolutionData: Array<{ name: string; count: number; percent: number }>;
  moduleData: Array<{ name: string; count: number; percent: number }>;
}

export default function DashboardCharts({ resolutionData, moduleData }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Resolution Types</CardTitle>
        </CardHeader>
        <CardContent>
          <ResolutionTypePie data={resolutionData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Module Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleDistribution data={moduleData} />
        </CardContent>
      </Card>
    </div>
  );
}
