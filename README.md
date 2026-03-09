# tomatty 🍅

[![Linux](https://img.shields.io/badge/platform-Linux-informational?logo=linux&logoColor=white)](https://kernel.org)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)](https://bun.sh)
[![MIT License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

---

<!-- PORTUGUÊS -->

## O que é

**tomatty** é um timer Pomodoro que roda no terminal (TUI), construído com [Bun](https://bun.sh) e [@opentui/core](https://github.com/anomalyco/opentui).

Ele foi feito para quem estuda/trabalha no Linux e quer um timer que realmente te libera durante a pausa — sem precisar ficar olhando para o relógio ou lembrar de voltar ao computador.

## O diferencial

A maioria dos timers Pomodoro simplesmente toca um sino quando o tempo acaba e espera você agir. O **tomatty** faz diferente: ao término de uma sessão de trabalho, ele **suspende o sistema** (sleep/S3) com um alarme de RTC configurado para a duração do intervalo.

Isso significa:

- A máquina desliga a tela e entra em suspensão real — você se levanta sem culpa
- No final do intervalo, o hardware acorda automaticamente via RTC
- O tomatty exibe a tela de "bem-vindo de volta" com os dados da sessão
- Se você acordar o computador antes do alarme, ele detecta o "early wake" e mostra o tempo restante

Nenhum script de cron, nenhum daemon rodando em segundo plano. Só `sudo rtcwake`.

## Por que desenvolvi

Eu sou alguém que, quando focado/concentrado em algo, principalmente se for estudando algo pelo qual me interesso, difícilmente dou uma pausa por conta própria, espero a exaustão e o estresse me pararem.

Por isso decidi criar o **tomatty**. Uma ferramenta simples de terminal, porém poderosa por causa de uma simples funcionalidade: *pausa forçada*. É tudo que eu preciso em um pomodoro para realmente descansar quando for para descansar.

Esse projeto reflete minha personalidade simples e gosto pelo minimalismo. Além disso, sempre quis ter um projeto de terminal (CLI ou TUI, tanto faz).

Como ainda sou estudante (e precisava de uma ferramenta dessas pra agora, justamente por isso), utilizei o Github Copilot integrado ao OpenCode para desenvolvê-lo.

## Screenshots / Demo

![](./tomatty.png)

## Requisitos do sistema

| Requisito                           | Detalhes                                                                |
| ----------------------------------- | ----------------------------------------------------------------------- |
| **Sistema operacional**             | Linux x86-64 ou arm64                                                   |
| **Runtime**                         | [Bun](https://bun.sh) ≥ 1.0                                             |
| **`rtcwake`**                       | Fornecido pelo pacote `util-linux` (já presente na maioria das distros) |
| **`sudo` sem senha para `rtcwake`** | Necessário para suspender o sistema (ver configuração abaixo)           |
| **Terminal**                        | Suporte a cores TrueColor recomendado (kitty, alacritty, ghostty, etc.) |

### Configurando sudo para rtcwake

O tomatty precisa de permissão para chamar `rtcwake` sem senha. Configure uma vez:

```sh
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/rtcwake" \
  | sudo tee /etc/sudoers.d/tomatty
```

## Como executar

### Desenvolvimento

```sh
# Instalar dependências
pnpm install   # ou: bun install

# Rodar com hot-reload
bun run dev
```

### Build (binário compilado)

```sh
bun run build
# Gera: dist/tomatty
```

O binário gerado é autocontido — inclui o runtime Bun e o código da aplicação. Basta copiar `dist/tomatty` para qualquer lugar no seu `$PATH`:

```sh
sudo cp dist/tomatty /usr/local/bin/tomatty
tomatty
```

> **Nota:** a biblioteca nativa `libopentui.so` é embutida no binário pelo `bun build --compile`. Nenhuma dependência extra é necessária em produção além do sudoers configurado.

## Como funciona

### Controles

| Tecla          | Ação                       |
| -------------- | -------------------------- |
| `Space`        | Iniciar / Pausar / Retomar |
| `R`            | Resetar sessão atual       |
| `E`            | Editar nome da tarefa      |
| `Q` / `Ctrl+C` | Sair                       |

### Máquina de estados

```
  [Space]            [Space]           fim do timer
   IDLE ──────────► WORKING ──────────► SUSPENDING
    ▲                  │ [Space]              │
    │                  ▼                     │ (sistema dorme e acorda)
    │               PAUSED                   ▼
    │                  │ [R]          IDLE_AFTER_BREAK
    └──────────────────┘                     │
                                      [Space]│
                                             └──► WORKING (nova sessão)
```

### Módulos

| Arquivo          | Responsabilidade                                                |
| ---------------- | --------------------------------------------------------------- |
| `src/index.ts`   | UI principal, loop de eventos, máquina de estados               |
| `src/timer.ts`   | Contagem regressiva orientada a delta-time (ticks do renderer)  |
| `src/suspend.ts` | Chama `sudo rtcwake` e aguarda o sistema retomar                |
| `src/storage.ts` | Persiste contagem de pomodoros em `~/.config/tomatty/data.json` |
| `src/state.ts`   | Enum `AppState`                                                 |
| `src/config.ts`  | Durações, número de sessões por ciclo e paleta de cores         |

### Persistência

Os dados são salvos em `~/.config/tomatty/data.json`:

```json
{
  "date": "2026-03-09",
  "count": 3,
  "totalEver": 47
}
```

O contador diário (`count`) reseta automaticamente no dia seguinte. O total acumulado (`totalEver`) nunca é zerado.

## Configuração

Edite `src/config.ts` antes de fazer o build:

| Constante             | Padrão             | Descrição                                 |
| --------------------- | ------------------ | ----------------------------------------- |
| `WORK_DURATION`       | `25 * 60` (1500 s) | Duração da sessão de trabalho             |
| `BREAK_DURATION`      | `5 * 60` (300 s)   | Duração do intervalo / tempo de suspensão |
| `POMODOROS_PER_CYCLE` | `4`                | Pomodoros por ciclo (dots no header)      |
| `COLOR_WORK`          | `#E74C3C`          | Cor do modo trabalho                      |
| `COLOR_BREAK`         | `#2ECC71`          | Cor da tela de retorno                    |

## Licença

MIT © 2026 — veja [LICENSE](./LICENSE)

---

---

<!-- ENGLISH -->

## What is it

**tomatty** is a terminal-based Pomodoro timer (TUI), built with [Bun](https://bun.sh) and [@opentui/core](https://github.com/anomalyco/opentui).

It was made for Linux users who want a timer that actually frees you during breaks — no watching the clock, no remembering to come back.

## What makes it different

Most Pomodoro timers simply ring a bell when time is up and wait for you to act. **tomatty** does something else: when a work session ends, it **suspends the system** (sleep/S3) with an RTC alarm set for the duration of the break.

This means:

- The screen turns off and the machine enters real suspend — you step away guilt-free
- At the end of the break, the hardware wakes automatically via RTC alarm
- tomatty shows a "welcome back" screen with session stats
- If you wake the machine early, it detects the early wake and shows the remaining time

No cron job, no background daemon. Just `sudo rtcwake`.

## Why I built it

I'm someone who, when focused on something — especially studying a topic I find genuinely interesting — rarely takes a break on my own. I tend to wait until exhaustion and stress force me to stop.

That's why I built **tomatty**. A simple terminal tool, yet powerful because of one specific feature: *forced breaks*. That's all I need from a Pomodoro timer to actually rest when it's time to rest.

This project also reflects my straightforward personality and taste for minimalism. On top of that, I had always wanted a terminal project of my own — CLI or TUI, didn't matter.

Since I'm still a student (and needed a tool like this right now, for exactly that reason), I used GitHub Copilot integrated with OpenCode to develop it.

## Screenshots / Demo

![](./tomatty.png)

## System requirements

| Requirement                           | Details                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| **OS**                                | Linux x86-64 or arm64                                           |
| **Runtime**                           | [Bun](https://bun.sh) ≥ 1.0                                     |
| **`rtcwake`**                         | Provided by the `util-linux` package (present on most distros)  |
| **Passwordless `sudo` for `rtcwake`** | Required to suspend the system (see setup below)                |
| **Terminal**                          | TrueColor support recommended (kitty, alacritty, ghostty, etc.) |

### Configuring sudo for rtcwake

tomatty needs permission to call `rtcwake` without a password prompt. Set it up once:

```sh
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/rtcwake" \
  | sudo tee /etc/sudoers.d/tomatty
```

## Running the project

### Development

```sh
# Install dependencies
pnpm install   # or: bun install

# Run with hot-reload
bun run dev
```

### Build (compiled binary)

```sh
bun run build
# Output: dist/tomatty
```

The resulting binary is self-contained — it bundles the Bun runtime and all application code. Just copy `dist/tomatty` anywhere on your `$PATH`:

```sh
sudo cp dist/tomatty /usr/local/bin/tomatty
tomatty
```

> **Note:** the native `libopentui.so` library is embedded into the binary by `bun build --compile`. No extra dependencies are needed in production beyond the sudoers entry above.

## How it works

### Controls

| Key            | Action                 |
| -------------- | ---------------------- |
| `Space`        | Start / Pause / Resume |
| `R`            | Reset current session  |
| `E`            | Edit task name         |
| `Q` / `Ctrl+C` | Quit                   |

### State machine

```
  [Space]            [Space]          timer ends
   IDLE ──────────► WORKING ──────────► SUSPENDING
    ▲                  │ [Space]              │
    │                  ▼                     │ (system sleeps and wakes)
    │               PAUSED                   ▼
    │                  │ [R]          IDLE_AFTER_BREAK
    └──────────────────┘                     │
                                      [Space]│
                                             └──► WORKING (new session)
```

### Modules

| File             | Responsibility                                            |
| ---------------- | --------------------------------------------------------- |
| `src/index.ts`   | Main UI, event loop, state machine                        |
| `src/timer.ts`   | Countdown driven by delta-time ticks from the renderer    |
| `src/suspend.ts` | Calls `sudo rtcwake` and waits for the system to resume   |
| `src/storage.ts` | Persists pomodoro counts to `~/.config/tomatty/data.json` |
| `src/state.ts`   | `AppState` enum                                           |
| `src/config.ts`  | Durations, sessions-per-cycle and color palette           |

### Persistence

Data is stored at `~/.config/tomatty/data.json`:

```json
{
  "date": "2026-03-09",
  "count": 3,
  "totalEver": 47
}
```

The daily counter (`count`) resets automatically the next day. The cumulative total (`totalEver`) never resets.

## Configuration

Edit `src/config.ts` before building:

| Constant              | Default            | Description                       |
| --------------------- | ------------------ | --------------------------------- |
| `WORK_DURATION`       | `25 * 60` (1500 s) | Work session duration             |
| `BREAK_DURATION`      | `5 * 60` (300 s)   | Break duration / suspend time     |
| `POMODOROS_PER_CYCLE` | `4`                | Pomodoros per cycle (header dots) |
| `COLOR_WORK`          | `#E74C3C`          | Work mode color                   |
| `COLOR_BREAK`         | `#2ECC71`          | Welcome-back screen color         |

## License

MIT © 2026 — see [LICENSE](./LICENSE)
