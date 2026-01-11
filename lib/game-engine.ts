export type Vector = { x: number; y: number }

export interface GameObject {
  id: string
  type: "ball" | "block" | "particle"
  subType?: "normal" | "explosive" | "metal" | "splitter" // Added subtypes for block variety
  pos: Vector
  velocity: Vector
  radius?: number
  width?: number
  height?: number
  color: string
  health?: number
  maxHealth?: number
  isStatic?: boolean
  lifetime?: number // For particles
}

export class GameEngine {
  objects: GameObject[] = []
  lastTime = 0
  canvasWidth = 0
  canvasHeight = 0
  ballsToFire = 0
  fireTimer = 0
  fireRate = 0.05
  cannonPos: Vector = { x: 0, y: 0 }
  cannonAngle = 0
  onBlockDestroyed?: (block: GameObject) => void

  constructor(width: number, height: number) {
    this.canvasWidth = width
    this.canvasHeight = height
    this.cannonPos = { x: width / 2, y: height - 40 }
  }

  update(timestamp: number) {
    if (!this.lastTime) this.lastTime = timestamp
    const dt = (timestamp - this.lastTime) / 1000
    this.lastTime = timestamp

    // Handle firing queue
    if (this.ballsToFire > 0) {
      this.fireTimer += dt
      if (this.fireTimer >= this.fireRate) {
        this.spawnBall()
        this.ballsToFire--
        this.fireTimer = 0
      }
    }

    // Fixed time step for stability
    const subSteps = 4
    const subDt = dt / subSteps

    for (let s = 0; s < subSteps; s++) {
      this.objects.forEach((obj) => {
        if (obj.isStatic) return

        // Update position
        obj.pos.x += obj.velocity.x * subDt
        obj.pos.y += obj.velocity.y * subDt

        if (obj.type === "particle") {
          obj.lifetime = (obj.lifetime || 0) - subDt
        }

        // Wall collisions
        if (obj.radius) {
          if (obj.pos.x - obj.radius < 0) {
            obj.pos.x = obj.radius
            obj.velocity.x *= -0.9
          } else if (obj.pos.x + obj.radius > this.canvasWidth) {
            obj.pos.x = this.canvasWidth - obj.radius
            obj.velocity.x *= -0.9
          }

          if (obj.pos.y - obj.radius < 0) {
            obj.pos.y = obj.radius
            obj.velocity.y *= -0.9
          }

          // Cleanup balls that fall out the bottom
          if (obj.pos.y > this.canvasHeight + 50) {
            obj.health = 0 // Mark for removal
          }
        }
      })

      this.resolveCollisions()
    }

    // Cleanup dead objects
    this.objects = this.objects.filter((obj) => {
      if (obj.type === "particle") return (obj.lifetime || 0) > 0
      if (obj.type === "ball") return obj.health !== 0
      return obj.health === undefined || obj.health > 0
    })
  }

  spawnBall() {
    const speed = 800
    this.objects.push({
      id: `ball-${Math.random()}`,
      type: "ball",
      pos: { ...this.cannonPos },
      velocity: {
        x: Math.cos(this.cannonAngle) * speed,
        y: Math.sin(this.cannonAngle) * speed,
      },
      radius: 6,
      color: "var(--accent)",
    })
  }

  resolveCollisions() {
    const balls = this.objects.filter((o) => o.type === "ball")
    const blocks = this.objects.filter((o) => o.type === "block")

    balls.forEach((ball) => {
      blocks.forEach((block) => {
        this.checkBallBlockCollision(ball, block)
      })
    })
  }

  checkBallBlockCollision(ball: GameObject, block: GameObject) {
    if (!ball.radius || !block.width || !block.height) return

    const closestX = Math.max(block.pos.x, Math.min(ball.pos.x, block.pos.x + block.width))
    const closestY = Math.max(block.pos.y, Math.min(ball.pos.y, block.pos.y + block.height))

    const dx = ball.pos.x - closestX
    const dy = ball.pos.y - closestY
    const distanceSq = dx * dx + dy * dy

    if (distanceSq < ball.radius * ball.radius) {
      const distance = Math.sqrt(distanceSq) || 1
      const nx = dx / distance
      const ny = dy / distance

      const dot = ball.velocity.x * nx + ball.velocity.y * ny
      ball.velocity.x -= 2 * dot * nx
      ball.velocity.y -= 2 * dot * ny

      const overlap = ball.radius - distance
      ball.pos.x += nx * (overlap + 0.1)
      ball.pos.y += ny * (overlap + 0.1)

      // Damage handling
      if (block.subType !== "metal" && block.health !== undefined) {
        block.health -= 1
        if (block.health <= 0) {
          this.handleBlockDestruction(block)
        }
      }

      if (block.subType === "explosive") {
        this.triggerExplosion(block.pos.x + block.width / 2, block.pos.y + block.height / 2)
        block.health = 0
      }
    }
  }

  triggerExplosion(x: number, y: number) {
    const radius = 100
    this.objects.forEach((obj) => {
      if (obj.type === "block" && obj.subType !== "metal") {
        const dx = obj.pos.x + (obj.width || 0) / 2 - x
        const dy = obj.pos.y + (obj.height || 0) / 2 - y
        if (dx * dx + dy * dy < radius * radius) {
          obj.health = (obj.health || 0) - 10
        }
      }
    })
    // Add visual particles
    for (let i = 0; i < 20; i++) {
      this.objects.push({
        id: `p-${Math.random()}`,
        type: "particle",
        pos: { x, y },
        velocity: { x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400 },
        radius: 3,
        color: "var(--destructive)",
        lifetime: 0.5,
      })
    }
  }

  handleBlockDestruction(block: GameObject) {
    if (this.onBlockDestroyed) this.onBlockDestroyed(block)
    // Add shatter particles
    for (let i = 0; i < 8; i++) {
      this.objects.push({
        id: `p-${Math.random()}`,
        type: "particle",
        pos: { x: block.pos.x + (block.width || 0) / 2, y: block.pos.y + (block.height || 0) / 2 },
        velocity: { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200 },
        radius: 2,
        color: block.color,
        lifetime: 0.3,
      })
    }
  }
}
