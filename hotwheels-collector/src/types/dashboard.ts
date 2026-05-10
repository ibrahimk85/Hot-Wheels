export interface DashboardWidget {
  id: number;
  type: string;
  position: number;
  size: string;
  config: Record<string, any>;
}

export interface DashboardWidgetInput {
  id?: number;
  type: string;
  position: number;
  size: string;
  config: Record<string, any>;
}



