"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { generateInitialBlocks, checkPlacement, type BlockType } from "@/lib/game-logic"
import { cn } from "@/lib/utils"
import { Trophy, RotateCcw, Zap } from "lucide-react"

const GRID_SIZE = 8

type Theme = {
  name: string
  bg: string
  grid: string
  cell: string
  accent: string
}

const THEMES: Theme[] = [
  {
    name: "Neon",
    bg: "bg-slate-950",
    grid: "bg-slate-900/80 border-slate-800",
    cell: "bg-slate-800/30",
    accent: "text-amber-400",
  },
  {
    name: "Classic",
    bg: "bg-stone-100",
    grid: "bg-white border-stone-200",
    cell: "bg-stone-200",
    accent: "text-stone-900",
  },
  {
    name: "Space",
    bg: "bg-indigo-950",
    grid: "bg-indigo-900/40 border-indigo-800",
    cell: "bg-indigo-950/50",
    accent: "text-indigo-400",
  },
]

const triggerHaptic = (type: "light" | "medium" | "heavy") => {
  if (typeof window !== "undefined" && window.navigator.vibrate) {
    const pattern = type === "light" ? 10 : type === "medium" ? 20 : [20, 10, 20]
    window.navigator.vibrate(pattern)
  }
}

interface Particle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  color: string
  life: number
}

export function BlockPuzzle() {
  const [themeIdx, setThemeIdx] = useState(0)
  const currentTheme = THEMES[themeIdx]

  const [particles, setParticles] = useState<Particle[]>([])
  const [screenShake, setScreenShake] = useState(0)
  const [screenFlash, setScreenFlash] = useState(false)
  const [timeScale, setTimeScale] = useState(1)

  const [grid, setGrid] = useState<(string | null)[][]>(
    Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(null)),
  )
  const [availableBlocks, setAvailableBlocks] = useState<BlockType[]>([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [draggedBlock, setDraggedBlock] = useState<BlockType | null>(null)
  const [previewPos, setPreviewPos] = useState<{ row: number; col: number } | null>(null)
  const [isGameOver, setIsGameOver] = useState(false)
  const [combo, setCombo] = useState(0)
  const [clearingEffect, setClearingEffect] = useState<{ rows: number[]; cols: number[] } | null>(null)
  const [isCharging, setIsCharging] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (particles.length === 0) return
    const id = requestAnimationFrame(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * timeScale,
            y: p.y + p.vy * timeScale,
            life: p.life - 0.05 * timeScale,
          }))
          .filter((p) => p.life > 0),
      )
    })
    return () => cancelAnimationFrame(id)
  }, [particles, timeScale])

  useEffect(() => {
    const savedHighScore = localStorage.getItem("blockPuzzleHighScore")
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore, 10))
    }
  }, [])

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem("blockPuzzleHighScore", score.toString())
    }
  }, [score, highScore])

  const getGridCoords = (clientX: number, clientY: number) => {
    if (!gridRef.current) return null
    const rect = gridRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const col = Math.floor((x / rect.width) * GRID_SIZE)
    const row = Math.floor((y / rect.height) * GRID_SIZE)
    return { row, col }
  }

  const handleDragEnd = (event: any, block: BlockType) => {
    const coords = getGridCoords(event.clientX, event.clientY)
    if (coords) {
      handlePlaceBlock(coords.row, coords.col, block)
    }
    setDraggedBlock(null)
    setPreviewPos(null)
  }

  const handlePlaceBlock = async (row: number, col: number, blockToPlace: any) => {
    if (checkPlacement(grid, blockToPlace.shape, row, col)) {
      triggerHaptic("light")
      const newGrid = grid.map((r) => [...r])

      blockToPlace.shape.forEach((shapeRow: number[], rIdx: number) => {
        shapeRow.forEach((cell, cIdx) => {
          if (cell === 1) {
            newGrid[row + rIdx][col + cIdx] = blockToPlace.color
          }
        })
      })

      const placedCells = blockToPlace.shape.flat().filter((x: any) => x === 1).length
      let turnScore = placedCells

      const { grid: clearedGrid, linesCleared, rows, cols } = clearLines(newGrid)

      if (linesCleared > 0) {
        const newCombo = combo + 1
        setCombo(newCombo)

        if (newCombo >= 4) {
          setTimeScale(0.85)
          setTimeout(() => setTimeScale(1), 250)
        }

        setIsCharging(true)
        setScreenShake(linesCleared)
        for (let i = 0; i < linesCleared; i++) {
          await new Promise((r) => setTimeout(r, 20))
        }
        await new Promise((r) => setTimeout(r, 60))
        setIsCharging(false)

        setClearingEffect({ rows, cols })
        setScreenFlash(true)
        setTimeout(() => setScreenFlash(false), 50)
        triggerHaptic(linesCleared > 1 ? "heavy" : "medium")

        const newParticles: Particle[] = []
        const spawnRowParticles = (r: number) => {
          for (let c = 0; c < GRID_SIZE; c++) {
            const delay = Math.abs(c - GRID_SIZE / 2) * 20
            setTimeout(() => spawnParticles(newParticles, r, c, grid[r][c] || blockToPlace.color), delay)
          }
        }

        rows.forEach(spawnRowParticles)
        cols.forEach((c) => {
          for (let r = 0; r < GRID_SIZE; r++) {
            if (!rows.includes(r)) {
              const delay = Math.abs(r - GRID_SIZE / 2) * 20
              setTimeout(() => spawnParticles(newParticles, r, c, grid[r][c] || blockToPlace.color), delay)
            }
          }
        })
        setParticles((prev) => [...prev, ...newParticles])

        let linePoints = 10
        if (linesCleared === 2) linePoints = 30
        if (linesCleared >= 3) linePoints = 60 + (linesCleared - 3) * 30
        turnScore += linePoints * newCombo

        setTimeout(() => {
          setClearingEffect(null)
          setScreenShake(0)
        }, 500)
      } else {
        setCombo(0)
      }

      setGrid(clearedGrid)
      setScore((prev) => prev + turnScore)

      const nextAvailable = availableBlocks.filter((b) => b.id !== blockToPlace.id)
      setAvailableBlocks(nextAvailable)
    }
    setDraggedBlock(null)
    setPreviewPos(null)
  }

  const spawnParticles = (arr: Particle[], r: number, c: number, color: string) => {
    for (let i = 0; i < 4; i++) {
      arr.push({
        id: Math.random().toString(),
        x: c * (100 / GRID_SIZE) + 5,
        y: r * (100 / GRID_SIZE) + 5,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        color,
        life: 1,
      })
    }
  }

  const clearLines = useCallback((currentGrid: (string | null)[][]) => {
    const rowsToClear: number[] = []
    const colsToClear: number[] = []

    for (let r = 0; r < GRID_SIZE; r++) {
      if (currentGrid[r].every((cell) => cell !== null)) rowsToClear.push(r)
    }

    for (let c = 0; c < GRID_SIZE; c++) {
      let isFull = true
      for (let r = 0; r < GRID_SIZE; r++) {
        if (currentGrid[r][c] === null) {
          isFull = false
          break
        }
      }
      if (isFull) colsToClear.push(c)
    }

    const linesCleared = rowsToClear.length + colsToClear.length
    if (linesCleared > 0) {
      const newGrid = currentGrid.map((row) => [...row])
      rowsToClear.forEach((r) => newGrid[r].fill(null))
      colsToClear.forEach((c) => {
        for (let r = 0; r < GRID_SIZE; r++) newGrid[r][c] = null
      })
      return { grid: newGrid, linesCleared, rows: rowsToClear, cols: colsToClear }
    }

    return { grid: currentGrid, linesCleared: 0, rows: [], cols: [] }
  }, [])

  const checkGameOver = useCallback(
    (currentGrid: (string | null)[][], blocks: BlockType[]) => {
      if (blocks.length === 0) return false
      return !blocks.some((block) => {
        for (let r = 0; r <= GRID_SIZE - block.shape.length; r++) {
          for (let c = 0; c <= GRID_SIZE - block.shape[0].length; c++) {
            if (checkPlacement(currentGrid, block.shape, r, c)) return true
          }
        }
        return false
      })
    },
    [GRID_SIZE],
  )

  const resetGame = () => {
    const emptyGrid = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(null))
    setGrid(emptyGrid)
    setAvailableBlocks(generateInitialBlocks(emptyGrid))
    setScore(0)
    setIsGameOver(false)
    setCombo(0)
    setParticles([])
  }

  useEffect(() => {
    if (availableBlocks.length === 0 && !isGameOver) {
      const refilledBlocks = generateInitialBlocks(grid)
      setAvailableBlocks(refilledBlocks)

      if (checkGameOver(grid, refilledBlocks)) {
        setIsGameOver(true)
      }
    }
  }, [availableBlocks, grid, isGameOver, checkGameOver])

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-screen transition-all duration-500 p-4 font-sans select-none overflow-hidden",
        currentTheme.bg,
        themeIdx === 1 ? "text-stone-900" : "text-white",
        screenFlash && "brightness-150 saturate-150",
        combo >= 5 && "animate-[pulse_0.25s_infinite]",
      )}
    >
      <motion.div
        animate={
          screenShake > 0
            ? {
                x: [-1 * screenShake, 1 * screenShake, -1 * screenShake],
                y: [1 * screenShake, -1 * screenShake, 1 * screenShake],
              }
            : { x: 0, y: 0 }
        }
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.1 }}
        className="w-full max-w-md space-y-6 relative"
      >
        {/* Particles Layer */}
        <div className="absolute inset-0 pointer-events-none z-50">
          {particles.map((p) => (
            <div
              key={p.id}
              className={cn("absolute w-1 h-1 rounded-full", p.color)}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                opacity: p.life,
                transform: `scale(${p.life})`,
              }}
            />
          ))}
        </div>

        {/* Header Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm flex flex-col items-center justify-center col-span-1 shadow-lg ring-1 ring-white/10">
            <Zap className={cn("w-5 h-5 mb-1 animate-pulse", currentTheme.accent)} />
            <p className="text-[8px] opacity-50 uppercase font-black tracking-widest">Score</p>
            <p className="text-lg font-black">{score}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm flex flex-col items-center justify-center col-span-1 shadow-lg ring-1 ring-white/10">
            <Trophy className="text-emerald-400 w-5 h-5 mb-1" />
            <p className="text-[8px] opacity-50 uppercase font-black tracking-widest">Best</p>
            <p className="text-lg font-black">{highScore}</p>
          </div>
          <button
            onClick={() => setThemeIdx((prev) => (prev + 1) % THEMES.length)}
            className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm flex flex-col items-center justify-center hover:bg-white/10 transition-all col-span-1 shadow-lg ring-1 ring-white/10 group"
          >
            <Zap className="text-rose-400 w-5 h-5 mb-1 group-hover:rotate-12 transition-transform" />
            <p className="text-[8px] opacity-50 uppercase font-black tracking-widest">Theme</p>
            <p className="text-[8px] font-black">{currentTheme.name}</p>
          </button>
        </div>

        {/* Combo Indicator */}
        <div className="h-8 flex justify-center items-center">
          <AnimatePresence>
            {combo > 1 && (
              <motion.div
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{
                  scale: combo >= 4 ? [1, 1.2, 1] : 1,
                  opacity: 1,
                  y: 0,
                  filter: combo >= 3 ? "drop-shadow(0 0 10px currentColor)" : "none",
                }}
                transition={{ repeat: combo >= 4 ? Number.POSITIVE_INFINITY : 0, duration: 0.5 }}
                exit={{ scale: 2, opacity: 0 }}
                className={cn(
                  "font-black text-2xl italic tracking-tighter flex items-center gap-2 drop-shadow-md",
                  currentTheme.accent,
                  combo >= 3 && "animate-pulse",
                )}
              >
                COMBO x{combo}!
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main Grid */}
        <div className="relative aspect-square">
          <div
            ref={gridRef}
            className={cn(
              "w-full h-full border-4 rounded-xl p-2 shadow-2xl overflow-hidden grid gap-1 transition-all duration-300",
              currentTheme.grid,
              isCharging && "animate-pulse scale-[1.01]",
            )}
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
          >
            {grid.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const isPreview =
                  previewPos &&
                  draggedBlock &&
                  rIdx >= previewPos.row &&
                  rIdx < previewPos.row + draggedBlock.shape.length &&
                  cIdx >= previewPos.col &&
                  cIdx < previewPos.col + draggedBlock.shape[0].length &&
                  draggedBlock.shape[rIdx - previewPos.row][cIdx - previewPos.col] === 1

                const isClearing =
                  clearingEffect && (clearingEffect.rows.includes(rIdx) || clearingEffect.cols.includes(cIdx))

                const isChargingCell =
                  isCharging &&
                  clearingEffect &&
                  (clearingEffect.rows.includes(rIdx) || clearingEffect.cols.includes(cIdx))

                return (
                  <motion.div
                    key={`${rIdx}-${cIdx}`}
                    animate={
                      isClearing
                        ? { scale: [1, 1.2, 0], opacity: [1, 1, 0], rotate: [0, 5, -5] }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={isClearing ? { duration: 0.3 } : { type: "spring", stiffness: 400, damping: 25 }}
                    className={cn(
                      "w-full h-full rounded-sm transition-all duration-200 shadow-sm relative overflow-hidden",
                      cell ? cell : currentTheme.cell,
                      isPreview &&
                        (checkPlacement(grid, draggedBlock.shape, previewPos.row, previewPos.col)
                          ? "bg-emerald-400/40 scale-95 shadow-[0_0_15px_rgba(52,211,153,0.5)]"
                          : "bg-rose-500/30 scale-95 animate-pulse"),
                      isChargingCell && "brightness-200 blur-[1px] z-10",
                    )}
                  >
                    {cell && (
                      <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/20 rounded-sm" />
                    )}
                    {cell && (
                      <div className="absolute inset-[1px] border border-white/10 rounded-sm pointer-events-none" />
                    )}
                  </motion.div>
                )
              }),
            )}
          </div>

          {isGameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl rounded-xl flex flex-col items-center justify-center p-8 text-center"
            >
              <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">No More Moves!</h2>
              <p className="text-slate-400 mb-6">You've run out of space to place your blocks.</p>
              <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 w-full mb-8 shadow-inner ring-1 ring-white/5">
                <p className="text-sm text-slate-500 font-bold uppercase mb-1 tracking-widest">Final Score</p>
                <p className="text-6xl font-black text-white drop-shadow-lg">{score}</p>
              </div>
              <button
                onClick={resetGame}
                className="w-full h-14 rounded-full bg-white text-black font-black hover:bg-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/10"
              >
                Play Again
              </button>
            </motion.div>
          )}
        </div>

        {/* Block Tray */}
        <div className="flex justify-around items-center bg-white/5 rounded-[2.5rem] p-6 border border-white/10 backdrop-blur-md min-h-[160px] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          {availableBlocks.map((block: any) => (
            <motion.div
              key={block.id}
              animate={{ scale: [1, 1.02, 1], rotate: [0, 1, 0, -1, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3, ease: "easeInOut" }}
              drag
              dragSnapToOrigin
              onDragStart={() => {
                setDraggedBlock(block)
                triggerHaptic("light")
              }}
              onDrag={(e: any) => {
                const coords = getGridCoords(e.clientX, e.clientY)
                setPreviewPos(coords)
              }}
              onDragEnd={(e) => handleDragEnd(e, block)}
              whileHover={{ scale: 1.08 }}
              whileDrag={{
                scale: 1.15,
                zIndex: 50,
                transition: { type: "spring", stiffness: 300, damping: 30 },
                rotate: 0,
              }}
              className="cursor-grab active:cursor-grabbing p-2"
            >
              <div className="relative">
                <motion.div
                  className="absolute inset-0 bg-black/40 blur-xl rounded-full -z-10 translate-y-6"
                  initial={{ opacity: 0 }}
                  whileDrag={{ opacity: 1 }}
                />
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${block.shape[0].length}, 22px)` }}>
                  {block.shape.map((row: number[], r: number) =>
                    row.map((cell: number, c: number) => (
                      <div
                        key={`${r}-${c}`}
                        className={cn(
                          "w-[22px] h-[22px] rounded-md shadow-lg flex items-center justify-center transition-all relative",
                          cell === 1 ? block.color : "bg-transparent",
                        )}
                      >
                        {cell === 1 && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 rounded-md" />
                            <div className="absolute inset-[1px] border border-white/10 rounded-md" />
                          </>
                        )}
                      </div>
                    )),
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-center gap-4">
          <button
            onClick={resetGame}
            className="text-slate-500 hover:text-white hover:bg-white/5 rounded-full px-8 py-2 text-xs font-bold transition-all flex items-center gap-2 group border border-transparent hover:border-white/10"
          >
            <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" />
            Reset Game
          </button>
        </div>
      </motion.div>
    </div>
  )
}
