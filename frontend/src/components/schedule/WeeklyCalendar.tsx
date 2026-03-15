import React, { useMemo, useState, useEffect, useRef } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';
import { ScheduledClass, DAY_NAMES, SHORT_DAY_NAMES, minutesToTime, hasMeetingTimes } from './types';
import ClassDetailsModal from './ClassDetailsModal';

interface WeeklyCalendarProps {
  classes: ScheduledClass[];
  onRemoveClass: (classId: string) => void;
  /** classId → conflict message; blocks with a conflict get a red highlight */
  conflicts?: Record<string, string>;
  /** Called when the user activates a time slot (click or Enter/Space) */
  onSlotClick?: (day: string, hour: number) => void;
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

const START_HOUR = 7; // 7 AM
const END_HOUR = 22; // 10 PM
const DEFAULT_HOUR_HEIGHT = 120; // px per hour fallback

const GRID_ROWS = END_HOUR - START_HOUR + 1; // number of hour slots to render

export default function WeeklyCalendar({ classes, onRemoveClass, conflicts = {}, onSlotClick }: WeeklyCalendarProps) {
	  const [selectedClass, setSelectedClass] = useState<ScheduledClass | null>(null);
	  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	  const [hourHeight, setHourHeight] = useState<number>(DEFAULT_HOUR_HEIGHT);
	  // Only keep classes that have concrete meeting times; TBA/arranged
	  // sections are filtered out entirely so they never appear in the
	  // calendar UI.
	  const scheduledClasses = useMemo(() => {
	    return classes.filter(cls => hasMeetingTimes(cls));
	  }, [classes]);

  // Check if we need weekends based only on classes that actually meet.
  const hasWeekend = useMemo(() => {
    return scheduledClasses.some(c => {
      const days = c.occurrenceData?.daysOccurring;
      return (days?.Sa?.length ?? 0) > 0 || (days?.Su?.length ?? 0) > 0;
    });
  }, [scheduledClasses]);

	  const displayDays = hasWeekend 
	    ? ['M', 'Tu', 'W', 'Th', 'F', 'Sa', 'Su'] as const
	    : ['M', 'Tu', 'W', 'Th', 'F'] as const;

	  // Generate time labels
	  const timeLabels = useMemo(() => {
    const labels = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      labels.push(h);
    }
    return labels;
  }, []);

	  // Dynamically size the calendar so that, when possible, all time slots
	  // from START_HOUR to END_HOUR fit within the visible height of the
	  // scroll container. On very small viewports we fall back to a minimum
	  // hour height and allow vertical scrolling.
	  useEffect(() => {
	    const container = scrollContainerRef.current;
	    if (!container) return;

	    const updateHeights = () => {
	      const available = container.clientHeight;
	      if (!available || Number.isNaN(available)) return;

	      const idealHourHeight = Math.floor(available / GRID_ROWS);
	      // Don't let rows get impossibly tiny; below this we accept vertical scroll.
	      const next = idealHourHeight > 0 ? Math.max(40, idealHourHeight) : DEFAULT_HOUR_HEIGHT;
	      setHourHeight(next);
	    };

	    updateHeights();

	    if (typeof ResizeObserver !== 'undefined') {
	      const observer = new ResizeObserver(() => updateHeights());
	      observer.observe(container);
	      return () => observer.disconnect();
	    }

	    window.addEventListener('resize', updateHeights);
	    return () => window.removeEventListener('resize', updateHeights);
	  }, []);

	  const pixelsPerMinute = hourHeight / 60;

		  return (
		    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden relative">
	      {/* Empty state overlay */}
	      {scheduledClasses.length === 0 && (
	        <div role="status" aria-live="polite" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm pointer-events-none">
	          <p className="text-base font-semibold text-slate-600">No classes added yet</p>
	          <p className="text-sm text-slate-400 text-center max-w-xs px-4">
	            Search for classes in the sidebar and add them to build your schedule.
	          </p>
	        </div>
	      )}
	      {/* Scrollable Container */}
	      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative">
        <div className="min-w-[600px] flex flex-col"> {/* Min width to force horizontal scroll on small screens */}

            {/* Sticky Header */}
            <div className="flex border-b border-slate-200 sticky top-0 z-20 bg-white shadow-sm">
                <div className="w-16 shrink-0 bg-slate-50 border-r border-slate-200 sticky left-0 z-30" /> {/* Corner */}
                {displayDays.map(day => (
                <div key={day} className="flex-1 py-2 text-center border-r border-slate-200 last:border-r-0 bg-slate-50">
                    <span className="text-sm font-semibold text-slate-700">{SHORT_DAY_NAMES[day]}</span>
                </div>
                ))}
            </div>

	            {/* Calendar Body */}
		            <div className="flex" style={{ height: GRID_ROWS * hourHeight }}>
                {/* Time Column - Sticky Left */}
                <div className="w-16 shrink-0 border-r border-slate-200 bg-slate-50 select-none sticky left-0 z-10">
	                    {timeLabels.map(hour => (
                    <div 
                        key={hour} 
                        className="relative border-b border-slate-100 text-xs text-slate-400 text-right pr-2 pt-1 bg-slate-50"
	                        style={{ height: hourHeight }}
                    >
                        {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                    </div>
                    ))}
                </div>

	                {/* Days Columns */}
	                {displayDays.map(day => (
                    <div key={day} className="flex-1 relative border-r border-slate-200 last:border-r-0 min-w-[100px]">
	                    {/* Grid Lines / Time Slots */}
	                    {timeLabels.map(hour => (
	                        <div
	                        key={hour}
	                        role="button"
	                        tabIndex={0}
	                        aria-label={`Add class at ${DAY_NAMES[day]} ${formatHour(hour)}`}
	                        data-slot-day={day}
	                        data-slot-hour={hour}
	                        className="border-b border-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
	                        style={{ height: hourHeight }}
	                        onClick={() => onSlotClick?.(day, hour)}
	                        onKeyDown={(e) => {
	                          if (e.key === 'Enter' || e.key === ' ') {
	                            e.preventDefault();
	                            onSlotClick?.(day, hour);
	                            return;
	                          }
	                          const dayIdx = (displayDays as readonly string[]).indexOf(day);
	                          let tDay: string = day;
	                          let tHour = hour;
	                          switch (e.key) {
	                            case 'ArrowUp':    e.preventDefault(); tHour = Math.max(START_HOUR, hour - 1); break;
	                            case 'ArrowDown':  e.preventDefault(); tHour = Math.min(END_HOUR, hour + 1); break;
	                            case 'ArrowLeft':  e.preventDefault(); tDay = displayDays[Math.max(0, dayIdx - 1)] ?? day; break;
	                            case 'ArrowRight': e.preventDefault(); tDay = displayDays[Math.min(displayDays.length - 1, dayIdx + 1)] ?? day; break;
	                            default: return;
	                          }
	                          (document.querySelector(`[data-slot-day="${tDay}"][data-slot-hour="${tHour}"]`) as HTMLElement | null)?.focus();
	                        }}
	                        />
	                    ))}

                    {/* Class Blocks */}
                    {scheduledClasses.map(cls => {
                        const daySlots = cls.occurrenceData?.daysOccurring?.[day] ?? [];
                        const conflictMsg = conflicts[cls.id];
                        return daySlots.map((slot, idx) => {
                        const startMinutes = slot.startTime;
                        const endMinutes = slot.endTime;
	                        const duration = endMinutes - startMinutes;

	                        // Calculate position
	                        const top = (startMinutes - (START_HOUR * 60)) * pixelsPerMinute;
	                        const height = duration * pixelsPerMinute;

                        return (
                            <div
                            key={`${cls.id}-${day}-${idx}`}
                            tabIndex={0}
                            onClick={() => setSelectedClass(cls)}
                            onKeyDown={(e) => {
                              if (e.key === 'Delete' || e.key === 'Backspace') {
                                e.stopPropagation();
                                if (window.confirm(`Remove ${cls.code} from your schedule?`)) {
                                  onRemoveClass(cls.id);
                                }
                              } else if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                setSelectedClass(cls);
                              }
                            }}
                            className={`absolute inset-x-1 rounded-lg border shadow-sm p-2 overflow-hidden hover:z-10 hover:shadow-md transition-all group select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500${conflictMsg ? ' ring-2 ring-red-500/60' : ''}`}
                            style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                backgroundColor: conflictMsg ? '#FEF2F2' : cls.color,
                                borderColor: conflictMsg ? '#F87171' : cls.color.replace('100', '200'),
                            }}
                            title={conflictMsg}
                            >
                                {/* Conflict indicator */}
                                {conflictMsg && (
                                    <div className="absolute top-0.5 left-0.5 z-20">
                                        <FiAlertTriangle className="w-3 h-3 text-red-600" aria-hidden="true" />
                                    </div>
                                )}

                                {/* Close Button - Absolute Top Right */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveClass(cls.id);
                                    }}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 rounded-full text-slate-600 transition-all cursor-pointer z-20"
                                    aria-label={`Remove ${cls.code} from schedule`}
                                >
                                    <FiX className="w-3.5 h-3.5" />
                                </button>

                                {/* Content - Vertically Centered */}
                                <div className="flex flex-col justify-center items-center h-full gap-0.5 text-center">
                                    <span className={`font-bold text-sm leading-tight${conflictMsg ? ' text-red-800' : ' text-slate-900'}`}>
                                        {cls.code}
                                    </span>
                                    <div className={`text-xs font-medium leading-tight${conflictMsg ? ' text-red-700' : ' text-slate-700'}`}>
                                        {minutesToTime(startMinutes)} - {minutesToTime(endMinutes)}
                                    </div>
                                    <div className={`text-xs truncate w-full px-1${conflictMsg ? ' text-red-600' : ' text-slate-600'}`}>
                                        {cls.location}
                                    </div>
                                </div>
                            </div>
                        );
                        });
	                    })}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Class Details Modal */}
      <ClassDetailsModal
        isOpen={selectedClass !== null}
        onClose={() => setSelectedClass(null)}
        classData={selectedClass}
      />
    </div>
  );
}
