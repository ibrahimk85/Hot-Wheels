import { Recommendations } from '@/components/Recommendations';

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Akıllı Öneriler</h2>
      </div>
      <Recommendations />
    </div>
  );
}




