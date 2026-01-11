"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { GameEngine, type GameObject } from "@/lib/game-engine"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Trophy, Target, Zap, RotateCcw, ArrowRight } from "lucide-react"

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [isAiming, setIsAiming] = useState(false)
  const [ballsAvailable, setBallsAvailable] = useState(10)
  const [gameState, setGameState] = useState<"playing" | "cleared" | "gameOver">("playing")
  const [blocksRemaining, setBlocksRemaining] = useState(0)
  const [totalBlocksInLevel, setTotalBlocksInLevel] = useState(0)

  const generateLevel = useCallback(
    (num: number) => {
      if (!engineRef.current) return
      engineRef.current.objects = []
      setGameState("playing")

      const rows = 4 + Math.min(num, 4)
      const cols = 6
      const padding = 5
      const w = (400 - (cols + 1) * padding) / cols
      const h = 25
      let count = 0

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.4) {
            const typeRoll = Math.random()
            let subType: GameObject["subType"] = "normal"
            let color = "var(--primary)"
            const health = num * 3 + Math.floor(Math.random() * 5)

            if (typeRoll > 0.92) {
              subType = "explosive"
              color = "var(--destructive)"
            } else if (typeRoll > 0.85) {
              subType = "metal"
              color = "var(--muted-foreground)"
            }

            engineRef.current.objects.push({
              id: `b-${num}-${r}-${c}-${Math.random()}`,
              type: "block",
              subType,
              pos: { x: padding + c * (w + padding), y: 60 + r * (h + padding) },
              velocity: { x: 0, y: 0 },
              width: w,
              height: h,
              color,
              health,
              maxHealth: health,
              isStatic: true,
            })
            if (subType !== "metal") count++
          }
        }
      }
      setTotalBlocksInLevel(count)
      setBlocksRemaining(count)
    },
    [level],
  )

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    engineRef.current = new GameEngine(canvas.width, canvas.height)
    engineRef.current.onBlockDestroyed = (block) => {
      if (block.subType !== "metal") {
        setScore((s) => s + 100)
        setBlocksRemaining((prev) => prev - 1)
      }
    }

    generateLevel(level)

    let animationId: number
    const render = (time: number) => {
      if (engineRef.current) {
        engineRef.current.update(time)

        if (gameState === "playing") {
          const activeBlocks = engineRef.current.objects.filter(
            (o) => o.type === "block" && o.subType !== "metal",
          ).length
          if (activeBlocks === 0 && totalBlocksInLevel > 0) {
            setGameState("cleared")
          }
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        engineRef.current.objects.forEach((obj) => {
          ctx.globalAlpha = obj.type === "particle" ? (obj.lifetime || 1) / 0.5 : 1
          ctx.fillStyle = obj.color

          if (obj.type === "ball" && obj.radius) {
            ctx.shadowBlur = 10
            ctx.shadowColor = obj.color
            ctx.beginPath()
            ctx.arc(obj.pos.x, obj.pos.y, obj.radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
          } else if (obj.type === "block" && obj.width && obj.height) {
            ctx.beginPath()
            ctx.roundRect(obj.pos.x, obj.pos.y, obj.width, obj.height, 6)
            ctx.fill()

            ctx.strokeStyle = "rgba(255,255,255,0.1)"
            ctx.stroke()

            if (obj.subType !== "metal") {
              ctx.fillStyle = "white"
              ctx.font = "bold 10px monospace"
              ctx.textAlign = "center"
              ctx.fillText(obj.health?.toString() || "", obj.pos.x + obj.width / 2, obj.pos.y + obj.height / 2 + 4)
            }
          } else if (obj.type === "particle" && obj.radius) {
            ctx.beginPath()
            ctx.arc(obj.pos.x, obj.pos.y, obj.radius, 0, Math.PI * 2)
            ctx.fill()
          }
        })

        ctx.globalAlpha = 1

        ctx.save()
        ctx.translate(engineRef.current.cannonPos.x, engineRef.current.cannonPos.y)
        ctx.rotate(engineRef.current.cannonAngle)
        ctx.fillStyle = "var(--primary)"
        ctx.fillRect(-15, -10, 40, 20)
        ctx.restore()
      }
      animationId = requestAnimationFrame(render)
    }

    animationId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationId)
  }, [generateLevel, level])

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsAiming(true)
    updateAim(e)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isAiming) updateAim(e)
  }

  const handlePointerUp = () => {
    if (isAiming && engineRef.current && gameState === "playing") {
      engineRef.current.ballsToFire = 10 + level * 2
    }
    setIsAiming(false)
  }

  const updateAim = (e: React.PointerEvent) => {
    if (!canvasRef.current || !engineRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const dx = x - engineRef.current.cannonPos.x
    const dy = y - engineRef.current.cannonPos.y
    engineRef.current.cannonAngle = Math.atan2(dy, dx)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 sm:p-6 select-none">
      <div className="w-full max-w-[400px] grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card/50 backdrop-blur-sm p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-1">
            <Trophy className="w-3 h-3 text-accent" />
            Score
          </div>
          <div className="text-xl font-black text-accent">{score.toLocaleString()}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-wider mb-1">
            <Target className="w-3 h-3 text-primary" />
            Progression
          </div>
          <div className="flex items-end gap-2">
            <div className="text-xl font-black text-primary">Level {level}</div>
            <div className="text-[10px] font-mono mb-1 text-muted-foreground">
              {Math.max(0, blocksRemaining)} / {totalBlocksInLevel}
            </div>
          </div>
          <Progress value={((totalBlocksInLevel - blocksRemaining) / totalBlocksInLevel) * 100} className="h-1 mt-2" />
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-secondary rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="relative bg-card/80 border border-white/10 rounded-xl shadow-2xl cursor-crosshair touch-none backdrop-blur-sm"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {gameState === "cleared" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md rounded-xl animate-in fade-in zoom-in duration-300">
            <div className="p-4 rounded-full bg-accent/20 mb-4">
              <Zap className="w-12 h-12 text-accent fill-accent animate-pulse" />
            </div>
            <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">Level Clear!</h2>
            <p className="text-muted-foreground font-mono text-sm mb-8 uppercase tracking-widest">+5,000 Bonus Pts</p>
            <Button
              size="lg"
              className="px-12 bg-accent text-accent-foreground hover:bg-accent/90 font-black uppercase tracking-widest rounded-full"
              onClick={() => {
                setLevel((l) => l + 1)
                setScore((s) => s + 5000)
              }}
            >
              Continue <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[400px] mt-8 flex gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl border border-white/5 bg-card/50 hover:bg-card text-muted-foreground h-12 w-12"
          onClick={() => generateLevel(level)}
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-center bg-card/50 backdrop-blur-sm border border-white/5 rounded-xl px-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Hold & Drag to Aim
        </div>
      </div>
    </div>
  )
}
