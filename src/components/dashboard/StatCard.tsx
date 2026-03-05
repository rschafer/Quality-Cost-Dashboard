import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export default function StatCard({ title, value, subtitle, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold mt-2 font-mono">{value}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <p
            className={`text-sm font-medium mt-2 ${
              trend.value > 0
                ? "text-red-600"
                : trend.value < 0
                  ? "text-green-600"
                  : "text-muted-foreground"
            }`}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
