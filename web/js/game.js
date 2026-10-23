// Traducción explícita, función por función, del código Lua de
// dante_estrellas_final.p8 (versión 1.4). Los nombres se conservan para
// poder comparar ambos textos línea a línea.
//
// PICO-8 usa números de punto fijo 16.16. Los literales fraccionarios se
// redondean a ese formato con fx(); como las demás operaciones son sumas,
// restas y comparaciones, los resultados coinciden exactamente en double.

export const fx = (v) => Math.round(v * 65536) / 65536;

const GRAVEDAD = fx(0.22);
const VEL_COMETA = fx(0.4);
const SALTO = -3.5;
const VY_MAX = 3;

const flr = Math.floor;
const abs = Math.abs;
const min = Math.min;
const max = Math.max;
const sgn = (v) => (v < 0 ? -1 : 1);

export class Game {
  // input: { btn(i), btnp(i) }; audio: { music(n, fade), sfx(n, canal) };
  // gfx: instancia de Gfx (puede omitirse en pruebas sin dibujo).
  constructor(cart, { input, audio, gfx }) {
    this.cart = cart;
    this.input = input;
    this.audio = audio;
    this.g = gfx;
    this.frames = 0;
  }

  mget(x, y) {
    if (x < 0 || x >= 128 || y < 0 || y >= 64) return 0;
    return this.cart.map[y * 128 + x];
  }

  fget(id, bit) {
    return (this.cart.flags[id] & (1 << bit)) !== 0;
  }

  // time() de la consola: segundos transcurridos a 60 cuadros por segundo.
  time() {
    return this.frames / 60;
  }

  _init() {
    this.cambiar_planeta(1);
    // iniciar la musica solo una vez
    this.audio.music(0, 500);
  }

  cambiar_planeta(n) {
    this.planeta = n;
    this.offset = (n - 1) * 16;
    this.estrellas = [];
    this.plataformas = [];
    this.temporales = [];
    this.recogidas = 0;
    this.rosa = null;
    this.victoria = false;
    this.listo = false;
    this.final_t = 0;
    this.camila_x = 136;
    this.corazon_sonido = false;

    this.dante = {
      x: 8, y: 80, vy: 0,
      en_suelo: false,
      andando: false,
      direccion: 1,
      sobre: null,
    };
    if (this.planeta === 1) this.dante.x = 60;

    // objetos de este planeta
    for (let cy = 0; cy <= 15; cy++) {
      for (let cx = 0; cx <= 15; cx++) {
        const id = this.mget(this.offset + cx, cy);
        const px = cx * 8;
        const py = cy * 8;

        if (id === 17) {
          this.estrellas.push({ x: px, y: py, tomada: false });
        } else if (id === 20) {
          this.rosa = { x: px, y: py };
        } else if (this.planeta === 2 && this.fget(id, 1)) {
          this.plataformas.push({
            x: px, y: py, origen: px,
            sprid: id, vel: VEL_COMETA, dx: 0,
            tipo: 1,
          });
        } else if (this.planeta === 3 && this.fget(id, 2)) {
          this.temporales.push({
            x: px, y: py, sprid: id,
            estado: 0, t: 0, tipo: 2,
          });
        }
      }
    }
  }

  // terrenos fijos: bandera 0
  solido(x, y) {
    if (x < 0 || x >= 128 || y < 0 || y >= 128) return false;
    const tx = this.offset + flr(x / 8);
    const ty = flr(y / 8);
    const id = this.mget(tx, ty);
    return this.fget(id, 0) && !this.fget(id, 1) && !this.fget(id, 2);
  }

  toca_muro(x, y) {
    return this.solido(x, y) || this.solido(x + 7, y) ||
      this.solido(x, y + 7) || this.solido(x + 7, y + 7);
  }

  mover_x(dx) {
    const dante = this.dante;
    while (abs(dx) > 0) {
      const paso = sgn(dx) * min(abs(dx), 1);
      const nx = dante.x + paso;
      if (nx < 0 || nx > 120 || this.toca_muro(nx, dante.y)) break;
      dante.x = nx;
      dx -= paso;
    }
  }

  // aterrizar sobre plataformas especiales
  caer_en(lista, pies, nuevos_pies) {
    const dante = this.dante;
    for (const p of lista) {
      if ((p.tipo === 1 || p.estado < 2) &&
        pies <= p.y && nuevos_pies >= p.y &&
        dante.x + 8 > p.x && dante.x < p.x + 8) {
        dante.y = p.y - 8;
        dante.vy = 0;
        dante.en_suelo = true;
        dante.sobre = p;

        // comenzar cuenta regresiva
        if (p.tipo === 2 && p.estado === 0) {
          p.estado = 1;
          p.t = 48;
        }
        return true;
      }
    }
    return false;
  }

  mover_y(dy) {
    const dante = this.dante;
    dante.en_suelo = false;
    dante.sobre = null;

    while (abs(dy) > 0) {
      const paso = sgn(dy) * min(abs(dy), 1);
      const ny = dante.y + paso;

      // mantener el salto superior original
      if (ny > 120 || this.toca_muro(dante.x, ny)) {
        if (paso > 0) dante.en_suelo = true;
        dante.vy = 0;
        break;
      }

      if (paso > 0) {
        const pies = dante.y + 8;
        const nuevos_pies = ny + 8;
        if (this.caer_en(this.plataformas, pies, nuevos_pies) ||
          this.caer_en(this.temporales, pies, nuevos_pies)) {
          return;
        }
      }

      dante.y = ny;
      dy -= paso;
    }
  }

  // cometas del planeta 2
  mover_plataformas() {
    for (const p of this.plataformas) {
      const antes = p.x;
      let nx = p.x + p.vel;
      if (nx > p.origen + 8) {
        nx = p.origen + 8;
        p.vel = -abs(p.vel);
      } else if (nx < p.origen - 8) {
        nx = p.origen - 8;
        p.vel = abs(p.vel);
      }
      p.x = nx;
      p.dx = p.x - antes;
    }
  }

  // cristales del planeta 3
  actualizar_temporales() {
    const dante = this.dante;
    for (const p of this.temporales) {
      if (p.estado === 1) {
        p.t -= 1;
        if (p.t <= 0) {
          p.estado = 2;
          p.t = 90;
          if (dante.sobre === p) {
            dante.en_suelo = false;
            dante.sobre = null;
          }
        }
      } else if (p.estado === 2) {
        p.t -= 1;
        if (p.t <= 0) {
          p.estado = 0;
          p.t = 0;
        }
      }
    }
  }

  _update60() {
    const { btn, btnp } = this.input;
    // continuar entre escenas
    if (this.victoria) {
      if (this.planeta === 3) {
        // primero se lee el mensaje
        this.final_t += 1;

        // camila entra luego de leer el mensaje (2.5 segundos)
        if (this.final_t > 150) {
          this.camila_x = max(72, this.camila_x - 0.5);
          if (this.camila_x <= 72 && !this.corazon_sonido) {
            this.audio.sfx(33, 3);
            this.corazon_sonido = true;
          }
        }

        // volver a jugar tras el abrazo
        if (this.final_t > 390 && btnp(4)) this.cambiar_planeta(1);
      } else {
        // continuar entre planetas
        if (!btn(4)) this.listo = true;
        if (this.listo && btnp(4)) this.cambiar_planeta(this.planeta + 1);
      }
      return;
    }

    const dante = this.dante;
    const soporte = dante.sobre;
    this.mover_plataformas();
    this.actualizar_temporales();

    // viajar encima de los cometas
    if (soporte && soporte.tipo === 1 && dante.en_suelo) this.mover_x(soporte.dx);

    let dx = 0;
    dante.andando = false;
    if (btn(0)) {
      dx = -1;
      dante.direccion = -1;
      dante.andando = true;
    }
    if (btn(1)) {
      dx = 1;
      dante.direccion = 1;
      dante.andando = true;
    }

    if (btnp(4) && dante.en_suelo) {
      dante.vy = SALTO;
      dante.en_suelo = false;
      dante.sobre = null;
    }

    dante.vy = min(dante.vy + GRAVEDAD, VY_MAX);
    this.mover_x(dx);
    this.mover_y(dante.vy);

    // recoger estrellas
    for (const e of this.estrellas) {
      if (!e.tomada &&
        dante.x < e.x + 8 && dante.x + 8 > e.x &&
        dante.y < e.y + 8 && dante.y + 8 > e.y) {
        e.tomada = true;
        this.recogidas += 1;
        this.audio.sfx(32, 3);
      }
    }

    // rescatar la rosa
    const rosa = this.rosa;
    if (rosa && this.estrellas.length > 0 &&
      this.recogidas === this.estrellas.length &&
      dante.x < rosa.x + 8 && dante.x + 8 > rosa.x &&
      dante.y < rosa.y + 8 && dante.y + 8 > rosa.y) {
      this.victoria = true;
      this.listo = false;
      // la musica continua durante el final
    }
  }

  dibujar_dante() {
    const dante = this.dante;
    let frame = 1;
    if (!dante.en_suelo) {
      if (dante.direccion === 1) frame = dante.vy < 0 ? 7 : 8;
      else frame = dante.vy < 0 ? 9 : 10;
    } else if (dante.andando) {
      const paso = flr(this.time() * 6) % 2;
      frame = (dante.direccion === 1 ? 3 : 5) + paso;
    } else {
      frame = 1 + (flr(this.time() * 1.5) % 2);
    }
    this.g.spr(frame, dante.x, dante.y);
  }

  dibujar_cuento() {
    const g = this.g;
    g.cls(13);
    g.pset(14, 15, 10);
    g.pset(101, 20, 7);
    g.pset(112, 48, 10);
    g.pset(20, 77, 7);
    g.pset(91, 103, 10);

    if (this.planeta === 1) {
      g.print('las estrellas', 38, 24, 7);
      g.print('brillaban para todos,', 20, 35, 7);
      g.print('pero aquella rosa', 30, 46, 10);
      g.print('brillaba para el.', 30, 58, 10);
      g.pset(87, 56, 10);
      g.pset(88, 55, 10);
      g.print('z para continuar', 30, 115, 7);
    } else if (this.planeta === 2) {
      g.print('dante siguio viajando', 20, 24, 7);
      g.print('entre los cometas,', 28, 37, 7);
      g.print('con su rosa muy cerca.', 18, 54, 10);
      g.print('z para continuar', 30, 115, 7);
    } else {
      // dedicatoria final centrada
      g.print('aquella rosa', 40, 18, 7);
      g.print('le recordaba el', 34, 30, 7);
      g.print('hermoso cabello rojito', 20, 42, 10);
      g.print('de su mama.', 42, 54, 10);

      g.print('ya es hora,', 44, 94, 7);
      g.print('de ir a casa', 48, 105, 10);

      // dante espera junto a la rosa
      g.spr(1, 48, 74);
      g.spr(20, 60, 74);

      // camila viene desde la derecha
      if (this.final_t > 150) {
        if (this.camila_x > 72) {
          const paso = flr(this.final_t / 8) % 2;
          g.spr(13 + paso, this.camila_x, 74);
        } else {
          // camila se queda junto a dante
          g.spr(12, 72, 74);

          // el corazon aparece al llegar y flota un pixel suavemente
          g.spr(29, 62, 64 - (flr(this.final_t / 24) % 2));
        }
      }

      if (this.final_t > 390) g.print('z para volver a jugar', 22, 119, 6);
    }

    // las primeras escenas quedan intactas
    if (this.planeta < 3) {
      g.spr(1, 54, 86);
      g.spr(20, 70, 86);
    }
  }

  _draw() {
    const g = this.g;
    if (this.victoria) {
      this.dibujar_cuento();
      return;
    }

    if (this.planeta === 1) {
      g.cls(13);
    } else if (this.planeta === 2) {
      g.cls(2);
      g.line(12, 20, 22, 14, 7);
      g.pset(28, 11, 10);
      g.line(80, 24, 87, 20, 10);
      g.pset(101, 36, 7);
    } else {
      g.cls(2);
      g.pset(18, 16, 14);
      g.pset(91, 12, 10);
      g.pset(108, 51, 7);
    }

    // pintar solo bloques fijos
    g.map(this.offset, 0, 0, 0, 16, 16, 1);

    // cometas que se desplazan
    for (const p of this.plataformas) g.spr(p.sprid, p.x, p.y);

    // cristales que desaparecen
    for (const p of this.temporales) {
      if (p.estado === 0 || (p.estado === 1 && (p.t > 18 || flr(p.t / 3) % 2 === 0))) {
        g.spr(p.sprid, p.x, p.y);
      }
    }

    for (const e of this.estrellas) if (!e.tomada) g.spr(17, e.x, e.y);

    if (this.rosa && this.estrellas.length > 0 && this.recogidas === this.estrellas.length) {
      g.spr(20, this.rosa.x, this.rosa.y);
    }

    this.dibujar_dante();

    // hud inferior
    g.rectfill(0, 112, 127, 127, 1);
    g.line(0, 111, 127, 111, 10);
    if (this.estrellas.length > 0 && this.recogidas === this.estrellas.length) {
      g.print('encuentra la rosa!', 28, 117, 10);
    } else {
      g.print('estrellas ' + this.recogidas + '/' + this.estrellas.length, 4, 117, 7);
      g.print('z saltar', 88, 117, 7);
    }
  }

  // Un cuadro completo de la consola: actualizar, dibujar y avanzar el reloj.
  step(draw = true) {
    this._update60();
    if (draw && this.g) this._draw();
    this.frames += 1;
  }
}
