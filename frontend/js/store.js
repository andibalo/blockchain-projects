// Web3 API Layer 3: Signer.sendTransaction — pays ETH for products
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6/dist/ethers.min.js";
import { PRODUCTS, OWNER_ADDRESS, FAUCET_ADDRESS, FAUCET_ABI } from "./config.js";
import { connectWallet, getStoredAddress, shortenAddress, initWalletButton } from "./wallet.js";

// ── helpers ────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

let provider, signer, userAddress;

// ── Render product grid ────────────────────────────────────────
function renderProducts() {
  const grid = $("product-grid");
  if (!grid) return;

  grid.innerHTML = PRODUCTS.map((p) => `
    <div class="product-card">
      <img src="${p.image}" alt="${p.name}" loading="lazy" />
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.description}</div>
        <div class="product-footer">
          <span class="product-price">${p.price} ETH</span>
          <button
            class="btn btn-primary btn-sm"
            data-id="${p.id}"
            data-price="${p.price}"
            data-name="${p.name}"
            onclick="window.buyProduct(this)"
          >Buy Now</button>
        </div>
      </div>
    </div>
  `).join("");
}

// ── Check wallet balance and show faucet banner if low ─────────
async function checkBalance() {
  if (!provider || !userAddress) return;
  try {
    const bal = await provider.getBalance(userAddress);
    const banner = $("low-balance-banner");
    if (banner) {
      // Show banner if balance < 0.01 ETH
      banner.classList.toggle("hidden", bal >= ethers.parseEther("0.01"));
    }
  } catch { /* non-critical */ }
}

// ── Buy a product (ETH transfer to owner) ─────────────────────
window.buyProduct = async function (btn) {
  const productId = btn.dataset.id;
  const price     = btn.dataset.price;
  const name      = btn.dataset.name;

  // Ensure wallet is connected first
  if (!signer) {
    try {
      const w = await connectWallet();
      provider    = w.provider;
      signer      = w.signer;
      userAddress = w.address;
    } catch (err) {
      showNotification(err.message, "error");
      return;
    }
  }

  const allBtns = document.querySelectorAll("[data-id]");
  allBtns.forEach((b) => (b.disabled = true));
  btn.innerHTML = '<span class="spinner"></span> Confirm in MetaMask…';

  try {
    // Web3 API: Signer.sendTransaction — sends ETH directly to owner's wallet
    const tx = await signer.sendTransaction({
      to:    OWNER_ADDRESS,
      value: ethers.parseEther(price),
    });

    showNotification(`Transaction submitted for "${name}"…`, "info");
    btn.innerHTML = '<span class="spinner"></span> Mining…';

    const receipt = await tx.wait(1);
    showNotification(`Purchase confirmed! "${name}" is yours.`, "success");
    showReceiptModal(name, price, receipt.hash);
    await checkBalance();
  } catch (err) {
    const msg = err?.code === "ACTION_REJECTED"
      ? "Transaction cancelled."
      : err?.reason || err?.message || "Purchase failed";
    showNotification(msg, "error");
  } finally {
    allBtns.forEach((b) => {
      b.disabled = false;
      if (b.dataset.name) {
        b.textContent = "Buy Now";
      }
    });
  }
};

// ── Receipt modal ──────────────────────────────────────────────
function showReceiptModal(name, price, txHash) {
  let modal = $("receipt-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "receipt-modal";
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.7);
      display:flex;align-items:center;justify-content:center;z-index:1000;`;
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="card" style="max-width:460px;width:90%;animation:fadeIn 0.2s">
      <h3 style="margin-bottom:1rem;color:var(--success)">Purchase Confirmed!</h3>
      <p class="mb-2">You bought: <strong>${name}</strong></p>
      <p class="mb-2 text-muted">Amount paid: <strong class="text-accent">${price} ETH</strong></p>
      <div class="tx-receipt mb-2">
        <a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" rel="noopener">
          View on Etherscan ↗
        </a>
      </div>
      <p class="text-muted mb-3" style="font-size:0.82rem">
        Ask the store owner to mint your NFT certificate using the NFT page.
      </p>
      <button class="btn btn-primary btn-full" onclick="document.getElementById('receipt-modal').remove()">
        Close
      </button>
    </div>
  `;
  modal.style.display = "flex";
}

// ── Toast notifications ────────────────────────────────────────
function showNotification(msg, type = "info") {
  let el = $("store-notification");
  if (!el) {
    el = document.createElement("div");
    el.id = "store-notification";
    el.style.cssText =
      "position:fixed;top:72px;right:1.5rem;max-width:380px;z-index:999;transition:opacity 0.3s";
    document.body.appendChild(el);
  }
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.opacity = "1";
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.classList.add("hidden"), 300);
  }, 6000);
}

// ── Init ───────────────────────────────────────────────────────
async function init() {
  renderProducts();

  initWalletButton({
    onConnect: async (address) => {
      const w = await connectWallet();
      provider    = w.provider;
      signer      = w.signer;
      userAddress = address;
      await checkBalance();
    },
  });

  const stored = getStoredAddress();
  if (stored) {
    try {
      const w = await connectWallet();
      provider    = w.provider;
      signer      = w.signer;
      userAddress = w.address;
      await checkBalance();
    } catch { /* will connect on click */ }
  }
}

document.addEventListener("DOMContentLoaded", init);
