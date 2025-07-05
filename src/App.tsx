import { useEffect, useRef, useState } from "react";
import characterRight1 from './kuvat/character_right1.png';
import characterRight2 from './kuvat/character_right2.png';
import characterRight3 from './kuvat/character_right3.png';
import characterLeft1 from './kuvat/character_left1.png';
import characterLeft2 from './kuvat/character_left2.png';
import characterLeft3 from './kuvat/character_left3.png';

const TILE_SIZE = 16;
const VIEW_WIDTH = 20;
const VIEW_HEIGHT = 15;
const MAP_WIDTH = 100;
const MAP_HEIGHT = 100;
const MOVE_SPEED = 2; // px per frame

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function generateMap(width: number, height: number) {
  const map = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const r = Math.random();
      if (r < 0.1) row.push(1);
      else if (r < 0.2) row.push(2);
      else row.push(0);
    }
    map.push(row);
  }
  return map;
}

const tileColors = ["#98fb98", "#3399ff", "#ffe4a0"];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facing, setFacing] = useState<"left" | "right">("left");
  const [frame, setFrame] = useState(0);
  const walkFrame = useRef(0);


  const [map] = useState(() => generateMap(MAP_WIDTH, MAP_HEIGHT));

  // Pelaajan sijainti pikseleinä
  const [pos, setPos] = useState<{ x: number; y: number }>({
    x: Math.floor(MAP_WIDTH / 2) * TILE_SIZE,
    y: Math.floor(MAP_HEIGHT / 2) * TILE_SIZE
  });

  // Skrollaus: mistä kohtaa karttaa näkyvä ruutu piirretään (nyt pikseleinä, ei tileinä)
  const [viewOffset, setViewOffset] = useState<{ x: number; y: number }>({
    x: pos.x - (VIEW_WIDTH * TILE_SIZE) / 2,
    y: pos.y - (VIEW_HEIGHT * TILE_SIZE) / 2
  });

  const pressedKeys = useRef<Set<string>>(new Set());

  // Ladataan hahmon kuvat valmiiksi
  const characterImgs = useRef<{
    left: HTMLImageElement[];
    right: HTMLImageElement[];
  } | null>(null);
  useEffect(() => {
    const loadImage = (src: string) => {
      const img = new window.Image();
      img.src = src;
      return img;
    };
    characterImgs.current = {
      left: [loadImage(characterLeft1), loadImage(characterLeft2), loadImage(characterLeft3), loadImage(characterLeft2)],
      right: [loadImage(characterRight1), loadImage(characterRight2), loadImage(characterRight3), loadImage(characterRight2)]
    };
  }, []);

  useEffect(() => {
    console.log("character: " + characterImgs.current?.left[1].src);
  }, [facing]);


  // Sulava liike
  useEffect(() => {
    let animId: number;
    function animate() {
      let dx = 0, dy = 0;
      const keys = pressedKeys.current;
      if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) dy -= 1;
      if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) dy += 1;
      if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
        dx -= 1;
        setFacing("left");
      }
      if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
        dx += 1;
        setFacing("right");
      }

      // diagonaalisen liikkeen normalisointi
      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx = dx / len;
        dy = dy / len;

        // Animaatioframejen päivitys vain kun liikutaan
        walkFrame.current++;
        if (walkFrame.current % 5 === 0) {
          setFrame(prev => (prev + 1) % 4); // Vaihdetaan 0 ↔ 1
        }
      } else {
        // Jos ei liiku, palauta frame nollaan
        setFrame(0);
        walkFrame.current = 0;
      }

      setPos(prev => {
        let newX = prev.x + dx * MOVE_SPEED;
        let newY = prev.y + dy * MOVE_SPEED;
        newX = clamp(newX, 0, MAP_WIDTH * TILE_SIZE - 1);
        newY = clamp(newY, 0, MAP_HEIGHT * TILE_SIZE - 1);
        return { x: newX, y: newY };
      });

      animId = requestAnimationFrame(animate);
    }
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Sulava viewOffset (skrollaus)
  useEffect(() => {
    let animId: number;
    function animateView() {
      // Haluttu offset: pelaaja keskelle ruutua, mutta rajoitetaan kartan reunoihin
      const targetX = clamp(
        pos.x - (VIEW_WIDTH * TILE_SIZE) / 2,
        0,
        MAP_WIDTH * TILE_SIZE - VIEW_WIDTH * TILE_SIZE
      );
      const targetY = clamp(
        pos.y - (VIEW_HEIGHT * TILE_SIZE) / 2,
        0,
        MAP_HEIGHT * TILE_SIZE - VIEW_HEIGHT * TILE_SIZE
      );

      setViewOffset(prev => {
        // Sulava siirtymä (voit säätää 0.15 arvoa)
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        return {
          x: Math.abs(prev.x - targetX) < 0.5 ? targetX : lerp(prev.x, targetX, 0.11),
          y: Math.abs(prev.y - targetY) < 0.5 ? targetY : lerp(prev.y, targetY, 0.11)
        };
      });

      animId = requestAnimationFrame(animateView);
    }
    animId = requestAnimationFrame(animateView);
    return () => cancelAnimationFrame(animId);
  }, [pos.x, pos.y]);

  // Piirrä peli
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Lasketaan, mistä tileistä aloitetaan ja paljonko offsetia jää
    const startTileX = Math.floor(viewOffset.x / TILE_SIZE);
    const startTileY = Math.floor(viewOffset.y / TILE_SIZE);
    const offsetX = viewOffset.x % TILE_SIZE;
    const offsetY = viewOffset.y % TILE_SIZE;

    // Piirretään tarpeeksi tilejä, jotta koko ruutu täyttyy
    const tilesX = VIEW_WIDTH + 2;
    const tilesY = VIEW_HEIGHT + 2;

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const mapX = startTileX + x;
        const mapY = startTileY + y;
        const tile = map[mapY]?.[mapX] ?? 0;
        ctx.fillStyle = tileColors[tile];
        ctx.fillRect(
          Math.floor(x * TILE_SIZE - offsetX),
          Math.floor(y * TILE_SIZE - offsetY),
          Math.ceil(TILE_SIZE),
          Math.ceil(TILE_SIZE)
        );
      }
    }

    // Piirrä hahmon kuva keskelle ruutua
    const playerScreenX = (pos.x - viewOffset.x);
    const playerScreenY = (pos.y - viewOffset.y);
    const imgs = characterImgs.current;
    const img = imgs ? (facing === "left" ? imgs.left[frame] : imgs.right[frame]) : null;
    if (img && img.complete) {
      ctx.drawImage(
        img,
        playerScreenX,
        playerScreenY,
        TILE_SIZE,
        TILE_SIZE
      );
    } else {
      // Jos kuva ei ole vielä ladattu, piirrä varakuutio
      ctx.fillStyle = "#2222ff";
      ctx.fillRect(
        playerScreenX + 4,
        playerScreenY + 4,
        TILE_SIZE - 8,
        TILE_SIZE - 8
      );
    }
  }, [pos, map, viewOffset, facing]);

  // Näppäimistöohjaus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      pressedKeys.current.add(e.key);
    }
    function handleKeyUp(e: KeyboardEvent) {
      pressedKeys.current.delete(e.key);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return (
    <div
      style={{
        background: "#222",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <canvas
        ref={canvasRef}
        width={VIEW_WIDTH * TILE_SIZE}
        height={VIEW_HEIGHT * TILE_SIZE}
        style={{
          border: "2px solid #444",
          imageRendering: "pixelated",
          width: (VIEW_WIDTH * TILE_SIZE * 2) + "px",
          height: (VIEW_HEIGHT * TILE_SIZE * 2) + "px"
        }}
        tabIndex={0}
      />
    </div>
  );
}