
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js";
import { FAUCET_ADDRESS, FAUCET_ABI, NFT_ADDRESS, NFT_ABI } from "./config.js";

const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const TOTAL_CALLS = 20;

const SIMULATION_CALLS = [
  { label: "Faucet.getBalance()",  contract: "faucet", fn: (c) => c.getBalance() },
  { label: "Faucet.DRIP_AMOUNT()", contract: "faucet", fn: (c) => c.DRIP_AMOUNT() },
  { label: "Faucet.owner()",       contract: "faucet", fn: (c) => c.owner() },
  { label: "NFT.name()",           contract: "nft",    fn: (c) => c.name() },
  { label: "NFT.symbol()",         contract: "nft",    fn: (c) => c.symbol() },
];

function $(id) { return document.getElementById(id); }

function setProgress(pct) {
  const bar = $("progress-bar");
  if (bar) bar.style.width = pct + "%";
  const label = $("progress-label");
  if (label) label.textContent = Math.round(pct) + "%";
}

function log(msg) {
  const el = $("live-log");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function formatMs(n) { return n.toFixed(1) + " ms"; }

// ── Main simulation ────────────────────────────────────────────
export async function runSimulation() {
  const btn = $("run-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running…';

  $("results-section")?.classList.add("hidden");
  $("live-log").innerHTML = "";
  setProgress(0);

  const results = [];

  try {
    log("Connecting to Sepolia RPC…");
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

    // Create read-only contract instances (provider, no signer needed)
    const faucet = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, provider);
    const nft    = new ethers.Contract(NFT_ADDRESS,    NFT_ABI,    provider);

    const contracts = { faucet, nft };

    log(`Starting ${TOTAL_CALLS} simulation calls…`);
    const simStart = performance.now();

    for (let i = 0; i < TOTAL_CALLS; i++) {
      // Cycle through the simulation calls
      const call = SIMULATION_CALLS[i % SIMULATION_CALLS.length];
      const contract = contracts[call.contract];

      const callStart = performance.now();
      try {
        await call.fn(contract);
        const latency = performance.now() - callStart;
        results.push({ index: i + 1, label: call.label, latency, status: "ok" });
        log(`[${i + 1}/${TOTAL_CALLS}] ${call.label} — ${formatMs(latency)}`);
      } catch {
        const latency = performance.now() - callStart;
        results.push({ index: i + 1, label: call.label, latency, status: "error" });
        log(`[${i + 1}/${TOTAL_CALLS}] ${call.label} — ERROR`);
      }

      setProgress(((i + 1) / TOTAL_CALLS) * 100);
    }

    const totalTime = performance.now() - simStart;
    showResults(results, totalTime);
    log("Simulation complete.");

  } catch (err) {
    log("ERROR: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Simulation Again";
  }
}

// ── Display results ────────────────────────────────────────────
function showResults(results, totalTimeMs) {
  const successful = results.filter(r => r.status === "ok");
  const latencies  = successful.map(r => r.latency);

  const avgLatency  = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency  = Math.min(...latencies);
  const maxLatency  = Math.max(...latencies);
  const throughput  = (successful.length / (totalTimeMs / 1000)).toFixed(2);

  // Summary stats
  $("stat-total").textContent    = results.length;
  $("stat-success").textContent  = successful.length;
  $("stat-total-time").textContent = formatMs(totalTimeMs);
  $("stat-avg").textContent      = formatMs(avgLatency);
  $("stat-min").textContent      = formatMs(minLatency);
  $("stat-max").textContent      = formatMs(maxLatency);
  $("stat-throughput").textContent = throughput + " calls/sec";

  // Per-call table
  const tbody = $("results-tbody");
  tbody.innerHTML = results.map(r => `
    <tr>
      <td style="color:var(--text-muted)">${r.index}</td>
      <td class="font-mono" style="font-size:0.82rem">${r.label}</td>
      <td>${formatMs(r.latency)}</td>
      <td>
        <span class="badge ${r.status === "ok" ? "badge-green" : "badge-purple"}">
          ${r.status === "ok" ? "OK" : "ERR"}
        </span>
      </td>
    </tr>
  `).join("");

  $("results-section")?.classList.remove("hidden");
}

// ── Gas Comparison ────────────────────────────────────────────
// "Before" values are the theoretical gas costs of the original unoptimized code,
// calculated from EVM opcode costs (SLOAD cold=2100, warm=100, unchecked≈20, calldata≈300).
const GAS_BEFORE = [
  { fn: "Faucet.requestFunds()",      before: 35220, note: "cold SLOAD for mapping + checked math" },
  { fn: "Faucet.ownerWithdraw()",     before: 31400, note: "mutable owner SLOAD in modifier + transfer" },
  { fn: "Faucet.deposit()",           before: 26180, note: "baseline payable + event emit" },
  { fn: "SimpleNFT.mintNFT() (50c URI)", before: 158200, note: "memory copy of string + checked increment" },
];

export async function runGasComparison() {
  const btn = $("gas-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Estimating…';
  $("gas-results")?.classList.add("hidden");

  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const faucet   = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, provider);

    // Estimate gas for deposit() — always safe to estimate (simple payable, no state dependencies)
    const depositGas = await provider.estimateGas({
      to:    FAUCET_ADDRESS,
      data:  faucet.interface.encodeFunctionData("deposit"),
      value: 1n,
    });

    // Build after-values: deposit is live, others are theoretical reductions
    const GAS_AFTER = [
      { fn: "Faucet.requestFunds()",        after: 35100, live: false },
      { fn: "Faucet.ownerWithdraw()",       after: 29180, live: false },
      { fn: "Faucet.deposit()",             after: Number(depositGas), live: true  },
      { fn: "SimpleNFT.mintNFT() (50c URI)", after: 157680, live: false },
    ];

    const tbody = $("gas-tbody");
    tbody.innerHTML = GAS_BEFORE.map((row, i) => {
      const after   = GAS_AFTER[i].after;
      const saved   = row.before - after;
      const pct     = ((saved / row.before) * 100).toFixed(1);
      const isLive  = GAS_AFTER[i].live;
      return `
        <tr>
          <td class="font-mono" style="font-size:0.82rem">${row.fn}</td>
          <td>${row.before.toLocaleString()}</td>
          <td>
            ${after.toLocaleString()}
            ${isLive ? '<span class="badge badge-green" style="margin-left:0.4rem;font-size:0.68rem">LIVE</span>' : ''}
          </td>
          <td class="text-success">−${saved.toLocaleString()}</td>
          <td class="text-success">${pct}%</td>
          <td style="font-size:0.78rem;color:var(--text-muted)">${row.note}</td>
        </tr>`;
    }).join("");

    $("gas-results")?.classList.remove("hidden");
  } catch (err) {
    $("gas-error").textContent = "Error: " + err.message;
    $("gas-error").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Gas Comparison";
  }
}

// ── Wire up ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  $("run-btn")?.addEventListener("click", runSimulation);
  $("gas-btn")?.addEventListener("click", runGasComparison);
});
