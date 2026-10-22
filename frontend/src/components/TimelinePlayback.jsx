import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  SkipBack, 
  Clock, 
  AlertCircle,
  Shield,
  Radio,
  ArrowRight
} from 'lucide-react';

export default function TimelinePlayback({
  events = [],
  currentIndex = 0,
  playbackState = 'paused',
  playbackSpeed = 1.0,
  onSelectIndex = () => {},
  onTogglePlay = () => {},
  onSetSpeed = () => {},
  onReset = () => {},
}) {
  const activeEvent = events[currentIndex] || null;
  const timerRef = useRef(null);

  // Playback loop (responsive intervals with readable visual transitions)
  useEffect(() => {
    if (playbackState === 'playing') {
      const intervalMs = Math.max(250, 1200 / playbackSpeed);
      timerRef.current = setInterval(() => {
        onSelectIndex((prevIndex) => {
          if (prevIndex < events.length - 1) {
            return prevIndex + 1;
          } else {
            onTogglePlay(); // Pause at end
            return prevIndex;
          }
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playbackState, playbackSpeed, events.length]);

  const severityBadgeClass = (sev) => {
    const s = String(sev || '').toLowerCase();
    if (s === 'critical') return 'nd-badge nd-badge-critical';
    if (s === 'high') return 'nd-badge nd-badge-high';
    if (s === 'medium') return 'nd-badge nd-badge-medium';
    if (s === 'low') return 'nd-badge nd-badge-low';
    return 'nd-badge nd-badge-neutral';
  };

  const getTickColor = (evt, isCurrent, isPassed) => {
    if (isCurrent) return 'var(--nd-accent)';
    const s = String(evt.severity || '').toLowerCase();
    if (isPassed) {
      if (s === 'critical') return 'var(--nd-critical)';
      if (s === 'high') return 'var(--nd-high)';
      if (s === 'medium') return 'var(--nd-medium)';
      return 'rgba(255, 255, 255, 0.4)';
    }
    return 'var(--nd-border-default)';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderTop: '1px solid var(--nd-border-default)',
      backgroundColor: 'var(--nd-bg-surface)',
      color: 'var(--nd-text-primary)',
      userSelect: 'none',
      flexShrink: 0,
      boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.3)',
    }}>
      {/* ── Active Event Banner ─────────────────────────────────────────── */}
      {activeEvent && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--nd-border-subtle)',
          backgroundColor: 'var(--nd-bg-elevated)',
          padding: '6px 18px',
          gap: 16,
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
            <span className={severityBadgeClass(activeEvent.severity)}>
              {activeEvent.severity}
            </span>
            <span style={{ fontFamily: 'var(--nd-font-mono)', fontWeight: 700, color: 'var(--nd-accent)' }}>
              {activeEvent.id}
            </span>
            {activeEvent.timestamp && (
              <span style={{ fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-muted)', fontSize: 11 }}>
                {new Date(activeEvent.timestamp).toLocaleTimeString()}
              </span>
            )}
            <span style={{
              color: 'var(--nd-text-primary)',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {activeEvent.summary}
            </span>
            {activeEvent.source_entity_id && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--nd-font-mono)',
                fontSize: 11,
                color: 'var(--nd-text-muted)',
                backgroundColor: 'var(--nd-bg-base)',
                padding: '1px 6px',
                borderRadius: 'var(--nd-radius-xs)',
                border: '1px solid var(--nd-border-subtle)',
                flexShrink: 0,
              }}>
                <span>{activeEvent.source_entity_id}</span>
                {activeEvent.target_entity_id && (
                  <>
                    <ArrowRight style={{ width: 10, height: 10 }} />
                    <span>{activeEvent.target_entity_id}</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontFamily: 'var(--nd-font-mono)', fontSize: 11, color: 'var(--nd-text-muted)' }}>
            <span>Event {currentIndex + 1} of {events.length}</span>
          </div>
        </div>
      )}

      {/* ── Interactive Scrubber Track ─────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 18px',
        backgroundColor: 'var(--nd-bg-base)',
        gap: 6,
        overflowX: 'auto',
      }}>
        {events.map((evt, idx) => {
          const isPassed = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          const tickBg = getTickColor(evt, isCurrent, isPassed);

          return (
            <button
              key={evt.id}
              onClick={() => onSelectIndex(idx)}
              title={`${evt.id} [${evt.severity}]: ${evt.summary}`}
              style={{
                flex: 1,
                minWidth: 16,
                height: isCurrent ? 14 : 8,
                borderRadius: 4,
                border: isCurrent ? '1px solid #ffffff' : 'none',
                backgroundColor: tickBg,
                boxShadow: isCurrent ? '0 0 8px rgba(59, 130, 246, 0.8)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                padding: 0,
                outline: 'none',
                transform: isCurrent ? 'scaleY(1.2)' : 'scaleY(1)',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) e.currentTarget.style.opacity = '1';
              }}
            />
          );
        })}
      </div>

      {/* ── Playback Controls Bar ───────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        height: 44,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        backgroundColor: 'var(--nd-bg-surface)',
      }}>
        {/* Left: Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onSelectIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-border-default)',
              backgroundColor: 'var(--nd-bg-elevated)',
              color: currentIndex === 0 ? 'var(--nd-text-muted)' : 'var(--nd-text-primary)',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: currentIndex === 0 ? 0.5 : 1,
            }}
            title="Previous Event (Step Back)"
          >
            <SkipBack style={{ width: 14, height: 14 }} />
          </button>

          <button
            onClick={onTogglePlay}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--nd-radius-md)',
              border: 'none',
              backgroundColor: 'var(--nd-accent)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--nd-shadow-sm)',
            }}
            title={playbackState === 'playing' ? 'Pause Replay' : 'Play Replay'}
          >
            {playbackState === 'playing' ? (
              <>
                <Pause style={{ width: 14, height: 14 }} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play style={{ width: 14, height: 14 }} />
                <span>Play Replay</span>
              </>
            )}
          </button>

          <button
            onClick={() => onSelectIndex((i) => Math.min(events.length - 1, i + 1))}
            disabled={currentIndex >= events.length - 1}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-border-default)',
              backgroundColor: 'var(--nd-bg-elevated)',
              color: currentIndex >= events.length - 1 ? 'var(--nd-text-muted)' : 'var(--nd-text-primary)',
              cursor: currentIndex >= events.length - 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: currentIndex >= events.length - 1 ? 0.5 : 1,
            }}
            title="Next Event (Step Forward)"
          >
            <SkipForward style={{ width: 14, height: 14 }} />
          </button>

          <button
            onClick={onReset}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--nd-radius-md)',
              border: '1px solid var(--nd-border-default)',
              backgroundColor: 'var(--nd-bg-elevated)',
              color: 'var(--nd-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Reset to Event #1"
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
          </button>

          <div style={{ height: 18, width: 1, backgroundColor: 'var(--nd-border-default)', margin: '0 4px' }} />

          {/* Speed Pills */}
          <span style={{ fontSize: 11, fontFamily: 'var(--nd-font-mono)', color: 'var(--nd-text-muted)' }}>Speed:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {[0.5, 1.0, 2.0, 4.0].map((spd) => (
              <button
                key={spd}
                onClick={() => onSetSpeed(spd)}
                style={{
                  padding: '2px 7px',
                  borderRadius: 'var(--nd-radius-xs)',
                  border: playbackSpeed === spd ? '1px solid var(--nd-accent)' : '1px solid transparent',
                  backgroundColor: playbackSpeed === spd ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: playbackSpeed === spd ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                  fontSize: 11,
                  fontFamily: 'var(--nd-font-mono)',
                  fontWeight: playbackSpeed === spd ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Engine Sync Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--nd-text-secondary)' }}>
          <Radio style={{ width: 13, height: 13, color: 'var(--nd-accent)' }} className="animate-pulse" />
          <span>Synchronized with 3D Spatial &amp; 2D Causal Engine</span>
        </div>
      </div>
    </div>
  );
}
