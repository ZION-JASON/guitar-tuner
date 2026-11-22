import React from 'react';
import { getNoteName, shouldPreferFlats, STANDARD_OPEN_MIDI } from '../utils/musicTheory';

const GUITAR_STRING_X = [34, 56, 78, 100, 122, 144];
const FOUR_STRING_X = [45, 73, 101, 129];
const FIVE_STRING_X = [38, 63, 88, 113, 138];
const FRET_START_Y = 34;
const FRET_GAP = 28;
const NUM_FRETS = 5;

const ChordDiagramSVG = ({
  voicing,
  rootPc,
  labelMode = 'fingers',
  compact = false,
  preferFlats: preferFlatsProp = null,
  openMidi: openMidiProp = null,
  instrumentLabel = 'guitar',
}) => {
  if (!voicing) return null;

  const { frets, fingers, barre, startFret } = voicing;
  const openMidi = voicing.openMidi || openMidiProp || STANDARD_OPEN_MIDI;
  const stringX =
    frets.length === 4
      ? FOUR_STRING_X
      : frets.length === 5
        ? FIVE_STRING_X
        : GUITAR_STRING_X;
  const preferFlats =
    preferFlatsProp === null ? shouldPreferFlats(rootPc) : preferFlatsProp;
  const bottomY = FRET_START_Y + NUM_FRETS * FRET_GAP;

  return (
    <svg
      viewBox="0 0 172 198"
      className={compact ? 'w-full max-w-[152px] h-auto mx-auto select-none' : 'w-full max-w-[178px] h-auto mx-auto select-none'}
      role="img"
      aria-label={`${voicing.label} ${instrumentLabel} chord diagram`}
    >
      {/* Position marker if above fret 1 */}
      {startFret > 1 && (
        <text
          x="13"
          y={FRET_START_Y + FRET_GAP * 0.62}
          textAnchor="middle"
          className="fill-cyan-300 font-mono text-[11px] font-bold"
        >
          {startFret}fr
        </text>
      )}

      {/* Fret horizontal lines */}
      {Array.from({ length: NUM_FRETS + 1 }).map((_, idx) => {
        const y = FRET_START_Y + idx * FRET_GAP;
        const isNut = idx === 0 && startFret === 1;
        return (
          <line
            key={`fret-${idx}`}
            x1={stringX[0]}
            y1={y}
            x2={stringX[stringX.length - 1]}
            y2={y}
            stroke={isNut ? '#f8fafc' : 'rgba(255,255,255,0.24)'}
            strokeWidth={isNut ? 4.5 : 1.25}
            strokeLinecap="square"
          />
        );
      })}

      {/* Vertical strings */}
      {stringX.map((x, idx) => (
        <line
          key={`str-${idx}`}
          x1={x}
          y1={FRET_START_Y}
          x2={x}
          y2={bottomY}
          stroke="rgba(255,255,255,0.34)"
          strokeWidth={
            frets.length === 4 && instrumentLabel.toLowerCase() === 'ukulele'
              ? 1.25
              : idx < Math.ceil(stringX.length / 2)
                ? 1.8 - idx * 0.2
                : 1.15
          }
        />
      ))}

      {/* Barre indicator */}
      {barre && barre.fret >= startFret && barre.fret < startFret + NUM_FRETS && (
        <rect
          x={stringX[barre.fromString] - 8}
          y={FRET_START_Y + (barre.fret - startFret + 0.5) * FRET_GAP - 7}
          width={stringX[barre.toString] - stringX[barre.fromString] + 16}
          height={14}
          rx={2}
          fill="rgba(248, 250, 252, 0.22)"
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth={1}
        />
      )}

      {/* String markers (X / O), Finger dots, and Bottom note labels */}
      {frets.map((fret, sIdx) => {
        const x = stringX[sIdx];
        const midi = fret >= 0 ? openMidi[sIdx] + fret : null;
        const pc = midi !== null ? ((midi % 12) + 12) % 12 : null;
        const isRoot = pc === rootPc;
        const noteLabel = pc !== null ? getNoteName(pc, preferFlats) : '×';

        if (fret === -1) {
          return (
            <g key={`s-${sIdx}`}>
              <text
                x={x}
                y={FRET_START_Y - 12}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[12px] font-semibold"
              >
                ×
              </text>
              <text
                x={x}
                y={bottomY + 18}
                textAnchor="middle"
                className="fill-slate-500 font-mono text-[10px]"
              >
                ×
              </text>
            </g>
          );
        }

        if (fret === 0) {
          return (
            <g key={`s-${sIdx}`}>
              <circle
                cx={x}
                cy={FRET_START_Y - 16}
                r={5.5}
                fill={isRoot ? 'rgba(34,211,238,0.2)' : 'none'}
                stroke={isRoot ? '#22d3ee' : '#cbd5e1'}
                strokeWidth={1.8}
                className="studio-only"
              />
              <rect
                x={x - 5.5}
                y={FRET_START_Y - 21.5}
                width={11}
                height={11}
                fill={isRoot ? 'rgba(34,211,238,0.24)' : 'none'}
                stroke={isRoot ? '#22d3ee' : '#cbd5e1'}
                strokeWidth={2}
                className="pixel-only"
              />
              <text
                x={x}
                y={bottomY + 18}
                textAnchor="middle"
                className={
                  isRoot
                    ? 'fill-cyan-300 font-mono text-[10px] font-bold'
                    : 'fill-slate-300 font-mono text-[10px]'
                }
              >
                {noteLabel}
              </text>
            </g>
          );
        }

        const relFret = fret - startFret;
        if (relFret < 0 || relFret >= NUM_FRETS) return null;

        const cy = FRET_START_Y + (relFret + 0.5) * FRET_GAP;
        const fingerNum = fingers?.[sIdx];
        const dotText =
          labelMode === 'notes'
            ? noteLabel
            : fingerNum > 0
              ? String(fingerNum)
              : '';

        return (
          <g key={`s-${sIdx}`}>
            <circle
              cx={x}
              cy={cy}
              r={9.5}
              fill={isRoot ? '#22d3ee' : '#f8fafc'}
              stroke={isRoot ? '#a5f3fc' : 'rgba(15,23,42,0.5)'}
              strokeWidth={1.2}
              className="studio-only"
            />
            <rect
              x={x - 9.5}
              y={cy - 9.5}
              width={19}
              height={19}
              fill={isRoot ? '#22d3ee' : '#f8fafc'}
              stroke={isRoot ? '#083344' : '#020617'}
              strokeWidth={2}
              className="pixel-only"
            />
            {dotText && (
              <text
                x={x}
                y={cy + 3.5}
                textAnchor="middle"
                className="fill-slate-950 font-mono text-[10px] font-bold"
              >
                {dotText}
              </text>
            )}
            <text
              x={x}
              y={bottomY + 18}
              textAnchor="middle"
              className={
                isRoot
                  ? 'fill-cyan-300 font-mono text-[10px] font-bold'
                  : 'fill-slate-300 font-mono text-[10px]'
              }
            >
              {noteLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default ChordDiagramSVG;
