'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { StatsWidget } from './widgets/StatsWidget';
import { ChartWidget } from './widgets/ChartWidget';
import { CollectionWidget } from './widgets/CollectionWidget';
import { GoalWidget } from './widgets/GoalWidget';
import { AchievementWidget } from './widgets/AchievementWidget';
import { Button } from '@/components/ui/button';
import { Settings, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WidgetEditor } from './WidgetEditor';
import type { DashboardWidget } from '@/types/dashboard';

interface DraggableDashboardProps {
  layoutId: number;
  widgets: DashboardWidget[];
  onWidgetsChange: (widgets: DashboardWidget[]) => void;
}

function SortableWidget({
  widget,
  children,
}: {
  widget: DashboardWidget;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sizeClasses: Record<string, string> = {
    '1x1': 'col-span-1 row-span-1',
    '2x1': 'col-span-2 row-span-1',
    '1x2': 'col-span-1 row-span-2',
    '2x2': 'col-span-2 row-span-2',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={sizeClasses[widget.size] || 'col-span-1 row-span-1'}
    >
      {children}
    </div>
  );
}

export function DraggableDashboard({
  layoutId,
  widgets,
  onWidgetsChange,
}: DraggableDashboardProps) {
  const [sortedWidgets, setSortedWidgets] = useState(widgets);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [showAddWidget, setShowAddWidget] = useState(false);

  useEffect(() => {
    setSortedWidgets([...widgets].sort((a, b) => a.position - b.position));
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedWidgets.findIndex((w) => w.id.toString() === active.id);
      const newIndex = sortedWidgets.findIndex((w) => w.id.toString() === over.id);

      const newWidgets = arrayMove(sortedWidgets, oldIndex, newIndex);
      const updatedWidgets = newWidgets.map((w, idx) => ({ ...w, position: idx }));

      setSortedWidgets(updatedWidgets);
      onWidgetsChange(updatedWidgets);

      // API'ye kaydet
      await fetch('/api/dashboard/widgets/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layoutId,
          widgets: updatedWidgets.map((w) => ({ id: w.id, position: w.position })),
        }),
      });
    }
  };

  const renderWidget = (widget: DashboardWidget) => {
    const commonProps = {
      config: widget.config,
    };

    switch (widget.type) {
      case 'stats':
        return <StatsWidget key={widget.id} {...commonProps} />;
      case 'chart':
        return <ChartWidget key={widget.id} {...commonProps} />;
      case 'collection':
        return <CollectionWidget key={widget.id} {...commonProps} />;
      case 'goal':
        return <GoalWidget key={widget.id} {...commonProps} />;
      case 'achievement':
        return <AchievementWidget key={widget.id} {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <div className="flex gap-2">
          <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Widget Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Widget Ekle</DialogTitle>
              </DialogHeader>
              <WidgetEditor
                layoutId={layoutId}
                onSave={(widget) => {
                  onWidgetsChange([...sortedWidgets, widget]);
                  setShowAddWidget(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedWidgets.map((w) => w.id.toString())}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-4 auto-rows-fr">
            {sortedWidgets.map((widget) => (
              <SortableWidget key={widget.id} widget={widget}>
                <div className="relative group">
                  {renderWidget(widget)}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingWidget(widget)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editingWidget && (
        <Dialog open={!!editingWidget} onOpenChange={() => setEditingWidget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Widget Düzenle</DialogTitle>
            </DialogHeader>
            <WidgetEditor
              layoutId={layoutId}
              widget={editingWidget}
              onSave={(updated) => {
                const newWidgets = sortedWidgets.map((w) =>
                  w.id === updated.id ? updated : w
                );
                onWidgetsChange(newWidgets);
                setEditingWidget(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

