export type BlockType = {
  shape: number[][]
  color: string
  id: string
}

export const SHAPES = [
  { shape: [[1]], color: "bg-blue-500" }, // 1x1
  { shape: [[1, 1]], color: "bg-emerald-500" }, // 1x2
  { shape: [[1, 1, 1]], color: "bg-amber-500" }, // 1x3
  { shape: [[1, 1, 1, 1]], color: "bg-amber-500" }, // 1x4
  { shape: [[1], [1]], color: "bg-emerald-500" }, // 2x1
  { shape: [[1], [1], [1]], color: "bg-amber-500" }, // 3x1
  { shape: [[1], [1], [1], [1]], color: "bg-amber-500" }, // 4x1
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "bg-rose-500",
  }, // 2x2
  // L-Shapes
  {
    shape: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    color: "bg-violet-500",
  },
  {
    shape: [
      [0, 1],
      [0, 1],
      [1, 1],
    ],
    color: "bg-violet-500",
  },
  {
    shape: [
      [1, 1],
      [1, 0],
      [1, 0],
    ],
    color: "bg-violet-500",
  },
  {
    shape: [
      [1, 1],
      [0, 1],
      [0, 1],
    ],
    color: "bg-violet-500",
  },
  // Z-Shapes
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "bg-orange-500",
  },
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "bg-orange-500",
  },
  // T-Shape
  {
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
    color: "bg-cyan-500",
  },
]

export function generateInitialBlocks(grid: (string | null)[][]): BlockType[] {
  let blocks: BlockType[] = []

  do {
    blocks = Array.from({ length: 3 }, () => {
      const randomShape = SHAPES[Math.floor(Math.random() * SHAPES.length)]
      return {
        ...randomShape,
        id: Math.random().toString(36).substr(2, 9),
      }
    })
  } while (!canPlaceAnyBlock(grid, blocks))

  return blocks
}

function canPlaceAnyBlock(grid: (string | null)[][], blocks: BlockType[]): boolean {
  return blocks.some((block) => {
    for (let r = 0; r <= grid.length - block.shape.length; r++) {
      for (let c = 0; c <= grid[0].length - block.shape[0].length; c++) {
        if (checkPlacement(grid, block.shape, r, c)) return true
      }
    }
    return false
  })
}

export function checkPlacement(grid: (string | null)[][], shape: number[][], row: number, col: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] === 1) {
        const targetRow = row + r
        const targetCol = col + c
        if (
          targetRow < 0 ||
          targetRow >= grid.length ||
          targetCol < 0 ||
          targetCol >= grid[0].length ||
          grid[targetRow][targetCol] !== null
        ) {
          return false
        }
      }
    }
  }
  return true
}
