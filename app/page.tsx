'use client';

import { useState, useEffect } from 'react';
import CustomWalletBtn from './components/CustomWalletBtn';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { createRefiPoolSDK } from './sdk';

type Pool = {
  name: string;
  sym: string;
  apy: number;
  pps: number;
  tvl: number;
  shares: number;
  userShares: number;
  userCost: number;
};

export default function ReFiApp() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [step, setStep] = useState<1 | 2 | 'deploy'>(1);
  const [view, setView] = useState<'wizard' | 'dashboard'>('wizard');

  const [pool, setPool] = useState<Pool>({
    name: '',
    sym: '',
    apy: 6,
    pps: 1,
    tvl: 0,
    shares: 0,
    userShares: 0,
    userCost: 0,
  });

  const [form, setForm] = useState({
    name: 'SolarYield Pool',
    symbol: 'sYLD',
    apy: 6,
  });

  const [deploying, setDeploying] = useState(false);
  const { publicKey, signTransaction } = useWallet();
  // =====================
  // DEPLOY
  // =====================
  const handleDeploy = async () => {
    try {
      if (!publicKey || !signTransaction) {
        throw new Error('Connect wallet first');
      }
      const connection = new Connection('https://api.devnet.solana.com');

      // ⚠️ You must already have program (Anchor)
      const sdk = createRefiPoolSDK({
        program,
        connection,
        wallet: {
          publicKey,
          signTransaction,
        },
      });

      setStep('deploy');
      setDeploying(true);

      const usdcMint = new PublicKey(
        'Es9vMFrzaCER...REPLACE_WITH_REAL' // devnet USDC
      );

      const config = {
        adminAuthority: publicKey,
        oracleAuthority: publicKey,
        feeCollector: publicKey,
        depositFeeBps: 50,
        withdrawalFeeBps: 50,
        managementFeeBps: 100,
        initialExchangeRate: 1,
        maxTotalSupply: 1_000_000_000,
        maxQueueSize: 100,
      };

      // =====================
      // STEP 1
      // =====================
      const { poolPda } = await sdk.initPool(usdcMint, config);

      // =====================
      // STEP 2
      // =====================
      await sdk.initPoolStep2(usdcMint, poolPda);

      // =====================
      // STEP 3
      // =====================
      await sdk.initWallets(
        poolPda,
        usdcMint,
        publicKey, // navWallet
        publicKey  // navWalletUsdc
      );

      setDeploying(false);

    } catch (err) {
      console.error(err);
      setDeploying(false);
    }
  };

  // =====================
  // DEPOSIT
  // =====================
  const deposit = (amount: number) => {
    if (!amount) return;

    const shares = Math.floor((amount / pool.pps) * 100) / 100;

    setPool(prev => ({
      ...prev,
      tvl: prev.tvl + amount,
      shares: prev.shares + shares,
      userShares: prev.userShares + shares,
      userCost: prev.userCost + amount,
    }));
  };

  // =====================
  // WITHDRAW
  // =====================
  const withdraw = (shares: number) => {
    if (!shares || shares > pool.userShares) return;

    const usdc = shares * pool.pps;
    const costBasis = (shares / pool.userShares) * pool.userCost;

    setPool(prev => ({
      ...prev,
      tvl: prev.tvl - usdc,
      shares: prev.shares - shares,
      userShares: prev.userShares - shares,
      userCost: prev.userCost - costBasis,
    }));
  };

  // =====================
  // RENDER
  // =====================
  return (
    <div className="app">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo">ReFi Hub</div>

        <CustomWalletBtn />
      </div>

      {/* ===== WIZARD ===== */}
      {view === 'wizard' && (
        <div className="card">
          <div className="wiz-h">
            <h2>Launch a pool</h2>
            <p>Deploy a yield pool on Solana in minutes</p>
          </div>

          <div className="steps">
            <div><div className="sd on" id="sd1">1</div><div className="slbl">Configure</div></div>
            <div className="sl" id="sl1"></div>
            <div><div className="sd" id="sd2">2</div><div className="slbl">Deploy</div></div>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div id="step1">
              <div className="fr mb-5">
                <div className="fg">
                  <label>Pool name</label>
                  <input type="text" id="poolName" placeholder="e.g. SolarYield Pool" value="SolarYield Pool" onChange={() => { }} />
                </div>
                <div className="fg">
                  <label>Token symbol</label>
                  <input type="text" id="tokenSymbol" placeholder="e.g. sYLD" value="sYLD" className='uppercase' onChange={() => { }} />
                  <div className="fhint">Max 6 characters</div>
                </div>
              </div>
              <div className="fg">
                <label>Target APY</label>
                <div className="iw">
                  <input type="number" id="targetAPY" value="6" min="0.1" max="50" step="0.1" onChange={() => { }} />
                  <span className="sf">%</span>
                </div>
                <div className="fhint">Annualized target return displayed to investors</div>
              </div>
              <div className="bg-[#F7F8FA] rounded-lg p-4 mt-5" style={{ padding: '20px' }}>
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px] mb-2.5">
                  Fixed parameters
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-[13px]">
                    <span className="text-gray-400">Base asset:</span> USDC
                  </div>
                  <div className="text-[13px]">
                    <span className="text-gray-400">Seed PPS:</span> $1.0000
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <div className="text-[13px]">
                    <span className="text-gray-400">Network:</span> Solana
                  </div>
                  <div className="text-[13px]">
                    <span className="text-gray-400">Withdrawals:</span> Instant at PPS
                  </div>
                </div>
              </div>
              <div className="brow">
                <div></div>
                <button className="bp" onClick={() => setStep(2)}>Review & deploy →</button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <div id="step2">
                <div className="rg">
                  <div className="ri"><div className="rl">Pool name</div><div className="rv" id="rName"></div></div>
                  <div className="ri"><div className="rl">Token symbol</div><div className="rv" id="rSymbol"></div></div>
                  <div className="ri"><div className="rl">Target APY</div><div className="rv gr" id="rAPY"></div></div>
                  <div className="ri"><div className="rl">Seed PPS</div><div className="rv">$1.0000</div></div>
                  <div className="ri"><div className="rl">Base asset</div><div className="rv">USDC</div></div>
                  <div className="ri"><div className="rl">Network</div><div className="rv">Solana (Devnet)</div></div>
                </div>
                <div className="note">⚡ Deploying will create a new pool on Solana devnet. You&apos;ll sign one transaction in your wallet.</div>
                <div className="brow">
                  <button className="bs" onClick={() => setStep(1)}>← Back</button>
                  <button className="bp" onClick={() => handleDeploy()}>Deploy pool</button>
                </div>
              </div>
            </>
          )}

          {/* DEPLOY */}
          {step === 'deploy' && (
            <div>
              {deploying ? (
                <p className='text-center m-auto'>Deploying...</p>
              ) : (
                <>
                  <div id="stepDeploy">
                    {/* LOADING */}
                    <div className="text-center py-12" id="dLoading">
                      <div className="m-auto mt-5 w-10 h-10 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>

                      <p className="text-[15px] font-semibold">
                        Deploying your pool...
                      </p>
                      <p className="text-[13px] text-gray-500 mt-1.5">
                        Confirm the transaction in your wallet
                      </p>
                    </div>

                    {/* SUCCESS */}
                    <div className="text-center py-12" id="dSuccess">
                      <div className="w-13 h-13 bg-green-50 m-auto rounded-full flex items-center justify-center mx-auto mb-3.5">
                        <svg
                          width="26"
                          height="26"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#22C55E"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>

                      <p className="text-[18px] font-semibold mb-1">
                        Pool deployed
                      </p>
                      <p className="text-[13px] text-gray-500">
                        Your pool is live on Solana devnet
                      </p>

                      <div className="font-mono text-[13px] bg-gray-100 px-4 py-2 rounded-md text-gray-500 inline-block my-2 border border-gray-200">
                        7xK9vRmTqPbJnW4cZdLf...mP4q
                      </div>

                      <br />

                      <a
                        href="#"
                        className="text-[12px] text-purple-500 no-underline"
                      >
                        View on Solana Explorer ↗
                      </a>

                      <div className="mt-6">
                        <button
                          className="bp"
                        // onClick={showDashboard}
                        >
                          Open pool dashboard →
                        </button>
                      </div>
                    </div>
                  </div>

                </>
              )}
            </div>
          )}
        </div>
      )
      }

      {/* ===== DASHBOARD ===== */}
      {
        view === 'dashboard' && (
          <div className="card">
            <h2>{pool.name}</h2>

            <div>APY: {pool.apy}%</div>
            <div>TVL: ${pool.tvl.toFixed(2)}</div>

            {/* Deposit */}
            <button onClick={() => deposit(100)}>Deposit $100</button>

            {/* Withdraw */}
            <button onClick={() => withdraw(10)}>Withdraw 10 shares</button>

            <div>Your Shares: {pool.userShares.toFixed(2)}</div>
            <div>
              Value: ${(pool.userShares * pool.pps).toFixed(2)}
            </div>
          </div>
        )
      }
    </div >
  );
}