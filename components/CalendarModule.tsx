
// ... existing imports ...
import React, { useState, useRef, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { db } from '../services/organizerDb';
import { OrgEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { X, Check, Trash2, MapPin } from 'lucide-react';

// ... (FC_THEME_OVERRIDES and other constants remain unchanged) ...
const FC_THEME_OVERRIDES = `
  :root {
    --fc-border-color: #2d0a0a;
    --fc-page-bg-color: transparent;
    --fc-neutral-bg-color: rgba(26, 5, 5, 0.5);
    --fc-list-event-hover-bg-color: #2d0a0a;
    --fc-today-bg-color: rgba(155, 44, 44, 0.1);
  }
  .fc { font-family: 'Inter', sans-serif; font-size: 11px; height: 100%; }
  .fc-col-header-cell-cushion { color: #9b2c2c; font-weight: 800; text-transform: uppercase; padding: 8px !important; letter-spacing: 0.05em; }
  .fc-daygrid-day-number { color: #9ca3af; font-weight: 500; text-decoration: none; padding: 4px; }
  .fc-event { border: none; border-radius: 2px; font-size: 10px; cursor: pointer; transition: transform 0.1s; box-shadow: 0 1px 2px rgba(0,0,0,0.5); }
  .fc-event:hover { transform: scale(1.02); z-index: 50; box-shadow: 0 4px 6px rgba(0,0,0,0.6); }
  .fc-event-main { padding: 2px 4px; color: #fff; font-weight: 600; }
  .fc-timegrid-slot-label-cushion { color: #6b7280; font-size: 9px; font-family: 'JetBrains Mono', monospace; }
  
  /* Toolbar Buttons */
  .fc-button-primary { background-color: #1a0505 !important; border-color: #4a0e0e !important; color: #9ca3af !important; text-transform: uppercase; font-size: 9px !important; font-weight: 700 !important; letter-spacing: 0.05em; border-radius: 4px !important; }
  .fc-button-primary:hover { background-color: #2d0a0a !important; border-color: #7f1d1d !important; color: #fff !important; }
  .fc-button-primary:not(:disabled).fc-button-active { background-color: #4a0e0e !important; border-color: #d4af37 !important; color: #d4af37 !important; }
  .fc-button-primary:focus { box-shadow: none !important; }
  
  .fc-toolbar-title { font-family: 'Cinzel', serif; color: #d4af37; font-size: 1.1rem !important; font-weight: 700; letter-spacing: 0.05em; }
  
  /* List View */
  .fc-list-day-cushion { background-color: #1a0505 !important; }
  .fc-list-event-title { color: #e5e7eb; }
  .fc-list-event-time { color: #9ca3af; font-family: 'JetBrains Mono', monospace; }
  .fc-list-table td { border-color: #2d0a0a; }
  
  /* Popover */
  .fc-popover { background-color: #1a0505; border-color: #4a0e0e; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
  .fc-popover-header { background-color: #2d0a0a; color: #d4af37; font-family: 'Cinzel', serif; }
  .fc-popover-body { background-color: #0a0a0c; }

  /* Now Indicator - Premium Polish */
  .fc-now-indicator-line {
    border-color: #ef4444; 
    border-width: 2px; 
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.6); 
    z-index: 20; 
  }
  .fc-now-indicator-arrow {
    border-color: #ef4444; 
    border-width: 5px 0 5px 6px; 
    border-bottom-color: transparent; 
    border-top-color: transparent; 
    z-index: 20;
  }
`;

const ensureStyles = () => {
    if (!document.getElementById('fc-theme-overrides')) {
        const style = document.createElement('style');
        style.id = 'fc-theme-overrides';
        style.innerHTML = FC_THEME_OVERRIDES;
        document.head.appendChild(style);
    }
};

// --- EFFICIENT NOW TIMER HOOK ---
function useMinuteAlignedNow(isActive: boolean) {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (!isActive) return;

        const tick = () => setNow(new Date());
        tick();

        const nowTs = Date.now();
        const msToNextMinute = 60000 - (nowTs % 60000);
        
        let interval: ReturnType<typeof setInterval> | null = null;
        
        const timeout = setTimeout(() => {
            tick();
            interval = setInterval(tick, 60000);
        }, msToNextMinute);

        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, [isActive]);

    return now;
}

interface EventModalProps {
    event: Partial<OrgEvent>;
    isOpen: boolean;
    onClose: () => void;
    onSave: (e: Partial<OrgEvent>) => void;
    onDelete?: (id: string) => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, isOpen, onClose, onSave, onDelete }) => {
    const [title, setTitle] = useState(event.title || '');
    const [location, setLocation] = useState(event.location || '');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [allDay, setAllDay] = useState(event.allDay || false);

    useEffect(() => {
        if (isOpen) {
            setTitle(event.title || '');
            setLocation(event.location || '');
            
            const now = new Date();
            const s = new Date(event.startAt || now.getTime());
            const sLocal = new Date(s.getTime() - (s.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setStart(sLocal);

            const e = new Date(event.endAt || now.getTime() + 3600000);
            const eLocal = new Date(e.getTime() - (e.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            setEnd(eLocal);
            
            setAllDay(event.allDay || false);
        }
    }, [event, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!title.trim()) return;
        const startTs = new Date(start).getTime();
        const endTs = new Date(end).getTime();
        
        onSave({
            ...event,
            title,
            location,
            startAt: startTs,
            endAt: endTs,
            allDay
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-md rounded-lg shadow-2xl p-4 animate-fadeIn">
                <div className="flex justify-between items-center mb-4 border-b border-cerberus-800 pb-2">
                    <h3 className="text-sm font-serif font-bold text-cerberus-accent uppercase tracking-widest">{event.id ? 'Edit Event' : 'New Event'}</h3>
                    <button onClick={onClose}><X size={18} className="text-gray-500 hover:text-white"/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] uppercase text-gray-500 mb-1">Title</label>
                        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-sm text-white focus:border-cerberus-accent outline-none" placeholder="Meeting..." />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase text-gray-500 mb-1">Location</label>
                        <div className="relative">
                            <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 pl-8 text-sm text-white focus:border-cerberus-accent outline-none" placeholder="Online / Office" />
                            <MapPin size={14} className="absolute left-2 top-2.5 text-gray-500"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] uppercase text-gray-500 mb-1">Start</label>
                            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase text-gray-500 mb-1">End</label>
                            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="allday" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="accent-cerberus-accent w-4 h-4 rounded"/>
                        <label htmlFor="allday" className="text-xs text-gray-300">All Day Event</label>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-cerberus-800">
                    {event.id && onDelete ? (
                        <button onClick={() => { if(confirm("Delete this event?")) onDelete(event.id!); onClose(); }} className="text-red-500 hover:text-red-400 p-2 rounded hover:bg-red-900/20"><Trash2 size={16}/></button>
                    ) : <div></div>}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-cerberus-600 hover:bg-cerberus-500 text-white rounded text-xs font-bold uppercase flex items-center gap-2">
                            <Check size={14}/> Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const CalendarModule: React.FC = () => {
    const calendarRef = useRef<FullCalendar>(null);
    const [modalEvent, setModalEvent] = useState<Partial<OrgEvent> | null>(null);
    
    // Timer Control State
    const [isTimeGrid, setIsTimeGrid] = useState(false); // Defaults false (DayGridMonth is default)
    const [isPageVisible, setIsPageVisible] = useState(!document.hidden);

    useEffect(() => {
        ensureStyles();
        
        const handleVisChange = () => setIsPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', handleVisChange);
        return () => document.removeEventListener('visibilitychange', handleVisChange);
    }, []);

    const now = useMinuteAlignedNow(isTimeGrid && isPageVisible);

    const [initialScrollTime] = useState(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - 90);
        return d.toTimeString().slice(0, 8); // HH:MM:SS
    });

    const fetchEvents = useCallback(async (fetchInfo: any, successCallback: any, failureCallback: any) => {
        try {
            const startMs = fetchInfo.start.valueOf();
            const endMs = fetchInfo.end.valueOf();

            const events = await db.events
                .where('endAt').above(startMs) 
                .and(e => e.startAt < endMs)   
                .toArray();

            const mappedEvents = events.map(e => ({
                id: e.id,
                title: e.title,
                start: new Date(e.startAt).toISOString(),
                end: new Date(e.endAt).toISOString(),
                allDay: e.allDay,
                backgroundColor: e.allDay ? '#4a0e0e' : '#2d0a0a',
                borderColor: e.allDay ? '#9b2c2c' : '#7f1d1d',
                textColor: '#e5e7eb',
                extendedProps: { location: e.location }
            }));

            successCallback(mappedEvents);
        } catch (e) {
            console.error("Calendar Fetch Error", e);
            failureCallback(e);
        }
    }, []);

    const handleDateSelect = (selectInfo: any) => {
        const calendarApi = selectInfo.view.calendar;
        calendarApi.unselect(); 

        setModalEvent({
            startAt: selectInfo.start.valueOf(),
            endAt: selectInfo.end.valueOf(),
            allDay: selectInfo.allDay
        });
    };

    const handleEventClick = (clickInfo: any) => {
        const { id, title, start, end, allDay, extendedProps } = clickInfo.event;
        setModalEvent({
            id,
            title,
            startAt: start?.valueOf(),
            endAt: end?.valueOf(),
            allDay,
            location: extendedProps.location
        });
    };

    const handleEventDrop = async (dropInfo: any) => {
        const { id, start, end, allDay } = dropInfo.event;
        let newEnd = end;
        if (!newEnd) {
            const oldDuration = (dropInfo.oldEvent.end?.valueOf() || 0) - (dropInfo.oldEvent.start?.valueOf() || 0);
            newEnd = new Date(start.valueOf() + (oldDuration || 3600000));
        }
        await db.events.update(id, {
            startAt: start.valueOf(),
            endAt: newEnd.valueOf(),
            allDay: allDay,
            updatedAt: Date.now()
        });
    };

    const handleEventResize = async (resizeInfo: any) => {
        const { id, start, end } = resizeInfo.event;
        await db.events.update(id, {
            startAt: start.valueOf(),
            endAt: end.valueOf(),
            updatedAt: Date.now()
        });
    };

    const handleDatesSet = (info: any) => {
        const type = info.view.type;
        setIsTimeGrid(type === 'timeGridWeek' || type === 'timeGridDay');
    };

    const saveEvent = async (event: Partial<OrgEvent>) => {
        if (event.id) {
            await db.events.update(event.id, {
                ...event,
                updatedAt: Date.now()
            });
        } else {
            await db.events.add({
                id: uuidv4(),
                title: event.title || 'New Event',
                startAt: event.startAt || Date.now(),
                endAt: event.endAt || Date.now() + 3600000,
                allDay: event.allDay || false,
                location: event.location,
                createdAt: Date.now(),
                updatedAt: Date.now()
            } as OrgEvent);
        }
        setModalEvent(null);
        calendarRef.current?.getApi().refetchEvents();
    };

    const deleteEvent = async (id: string) => {
        await db.events.delete(id);
        setModalEvent(null);
        calendarRef.current?.getApi().refetchEvents();
    };

    return (
        <div className="h-full w-full bg-cerberus-void text-gray-200 p-2 flex flex-col overflow-hidden">
            <div className="flex-1 bg-cerberus-900/30 rounded-lg border border-cerberus-800 p-1 shadow-inner overflow-hidden relative flex flex-col">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
                    }}
                    initialView="dayGridMonth"
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    dayMaxEvents={true}
                    weekends={true}
                    events={fetchEvents}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    datesSet={handleDatesSet}
                    
                    nowIndicator={true}
                    now={now}
                    scrollTime={initialScrollTime}
                    timeZone='local'
                    
                    height="100%"
                    contentHeight="auto"
                    longPressDelay={350} // Reduced for better response
                    eventLongPressDelay={350} // Reduced for better response
                    selectLongPressDelay={350} // Reduced for better response
                    navLinks={true}
                />
            </div>

            {/* Modal */}
            {modalEvent && (
                <EventModal 
                    event={modalEvent} 
                    isOpen={true} 
                    onClose={() => setModalEvent(null)} 
                    onSave={saveEvent}
                    onDelete={deleteEvent}
                />
            )}
        </div>
    );
};

export default CalendarModule;
