#!/usr/bin/env python3
"""
Erzeugt ECHTE Next-Token-Verteilungen aus einem lokalen Modell (GPT-2) und
schreibt sie im Schema der HTML-Visualisierung heraus.

Warum lokal? Die Anthropic-API liefert keine Logprobs. Willst du reale
Wahrscheinlichkeiten, brauchst du ein Modell mit Zugriff auf die Logits.

Setup:
    pip install torch transformers        # CPU reicht fuer distilgpt2/gpt2
Ausfuehren:
    python generate_probs.py --prompt "The cat sat" --steps 5 --topk 12

Output:
    steps.json           -> Rohdaten
    steps_snippet.js     -> fertig zum Einfuegen in autoregressive.html
                            (ersetzt dort die Konstante  const STEPS = [...]  )

Hinweis zur Genauigkeit der Demo-HTML: dort wird nur ueber die angezeigten
Top-Token gesampelt. Echtes Top-p/Top-k arbeitet ueber das volle Vokabular
(~50k Token). Fuer eine originalgetreue Simulation exportiere mehr Token
(--topk 50) oder rechne Sampling direkt hier.
"""
import argparse, json
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="distilgpt2",
                    help="z.B. distilgpt2 (schnell), gpt2, gpt2-large")
    ap.add_argument("--prompt", default="The cat sat")
    ap.add_argument("--steps", type=int, default=5)
    ap.add_argument("--topk", type=int, default=12, help="wie viele Token pro Schritt anzeigen")
    ap.add_argument("--temperature", type=float, default=1.0)
    ap.add_argument("--greedy", action="store_true",
                    help="argmax statt Sampling fuer die tatsaechlich gewaehlte Fortsetzung")
    args = ap.parse_args()

    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model).eval()
    eos_id = tok.eos_token_id

    ids = tok(args.prompt, return_tensors="pt").input_ids
    steps = []
    text = args.prompt

    with torch.no_grad():
        for _ in range(args.steps):
            logits = model(ids).logits[0, -1, :]            # Logits fuer die naechste Position
            logits = logits / max(args.temperature, 1e-6)
            probs = torch.softmax(logits, dim=-1)           # -> echte Wahrscheinlichkeiten

            top_p, top_i = torch.topk(probs, args.topk)
            dist = []
            for p, i in zip(top_p.tolist(), top_i.tolist()):
                # skip_special_tokens=False, damit ⟨EOS⟩ sichtbar bleibt
                t = tok.decode([i])
                dist.append([t if i != eos_id else "<|endoftext|>", round(p, 5)])

            steps.append({"after": f'"…{text[-25:]}"', "dist": dist})

            # tatsaechlich gewaehltes Token bestimmen
            if args.greedy:
                nxt = int(torch.argmax(probs))
            else:
                nxt = int(torch.multinomial(probs, 1))

            ids = torch.cat([ids, torch.tensor([[nxt]])], dim=1)
            text += tok.decode([nxt])
            if nxt == eos_id:
                break

    with open("steps.json", "w", encoding="utf-8") as f:
        json.dump(steps, f, ensure_ascii=False, indent=2)

    with open("steps_snippet.js", "w", encoding="utf-8") as f:
        f.write("const STEPS = " + json.dumps(steps, ensure_ascii=False, indent=2) + ";\n")

    print(f"Modell: {args.model} | Prompt: {args.prompt!r}")
    print(f"Generiert: {text!r}")
    print("Geschrieben: steps.json, steps_snippet.js")

if __name__ == "__main__":
    main()
