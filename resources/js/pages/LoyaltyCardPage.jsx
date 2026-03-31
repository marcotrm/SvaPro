import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Barcode from 'react-barcode';
import { Trophy, History, CreditCard, ChevronRight, Star } from 'lucide-react';

export default function LoyaltyCardPage() {
  const { uuid } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`/api/loyalty-card/${uuid}`);
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Errore nel caricamento della carta fedeltà');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [uuid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a227]"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-6">
        <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl text-center max-w-md">
          <p className="text-red-400 font-medium mb-2">Ops! Qualcosa è andato storto</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const { customer, wallet, history } = data;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-[#c9a227]/30">
      {/* Header */}
      <div className="max-w-md mx-auto pt-10 px-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">La Tua Card</h1>
            <p className="text-gray-400 text-sm">Programma Fedeltà Caruso</p>
          </div>
          <div className="bg-[#c9a227] p-2.5 rounded-xl shadow-[0_0_20px_rgba(201,162,39,0.3)]">
            <Star className="w-6 h-6 text-[#0f172a] fill-[#0f172a]" />
          </div>
        </div>

        {/* The Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-8 shadow-2xl border border-white/5 group hover:border-[#c9a227]/30 transition-all duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#c9a227] opacity-[0.03] blur-[80px] -mr-32 -mt-32 transition-opacity group-hover:opacity-[0.07]" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500 opacity-[0.03] blur-[60px] -ml-24 -mb-24" />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#c9a227] font-semibold mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold capitalize">{wallet.tier_code}</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-[#c9a227] animate-pulse" />
                </div>
              </div>
              <p className="text-lg font-black italic tracking-tighter opacity-20 group-hover:opacity-40 transition-opacity">SVA PRO</p>
            </div>

            <div className="mb-10">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-1">Saldo Punti</p>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black tabular-nums tracking-tighter bg-gradient-to-t from-gray-400 to-white bg-clip-text text-transparent">
                  {wallet.points_balance}
                </span>
                <span className="text-[#c9a227] font-bold text-sm tracking-widest ml-1">PTS</span>
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-white/5 pt-8 mt-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-0.5">Titolare</p>
                <p className="text-sm font-semibold tracking-wide whitespace-nowrap">{customer.first_name} {customer.last_name}</p>
              </div>
              <div className="bg-white p-2.5 rounded-xl shadow-inner group-hover:scale-[1.02] transition-transform duration-500">
                <Barcode 
                  value={customer.code} 
                  width={1.2} 
                  height={40} 
                  displayValue={false} 
                  background="#ffffff"
                  lineColor="#000000"
                  margin={0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Customer Code Info */}
        <div className="mt-6 flex items-center justify-center gap-2 bg-white/5 py-3 rounded-2xl border border-white/5">
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Account Code:</span>
          <span className="text-sm font-mono text-[#c9a227] font-bold tracking-widest">{customer.code}</span>
        </div>

        {/* Benefits Section */}
        <div className="mt-12">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#c9a227]" />
            I tuoi vantaggi
          </h2>
          <div className="grid gap-4">
            <div className="bg-white/5 border border-white/5 p-5 rounded-2xl hover:bg-white/[0.07] transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="bg-[#c9a227]/10 p-3 rounded-xl group-hover:bg-[#c9a227]/20 transition-colors">
                  <CreditCard className="w-5 h-5 text-[#c9a227]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">100 punti = 5,00€</p>
                  <p className="text-xs text-gray-400 mt-0.5">Converti i tuoi punti in sconti immediati</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>
            
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl opacity-60">
              <p className="text-[10px] uppercase tracking-widest text-[#c9a227] font-black mb-2 italic">Prossimo Obiettivo</p>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#c9a227] h-full rounded-full shadow-[0_0_8px_rgba(201,162,39,0.5)]" 
                  style={{ width: `${Math.min((wallet.points_balance % 100), 100)}%` }} 
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-2 text-right">Mancano {100 - (wallet.points_balance % 100)} punti al prossimo buono</p>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="mt-12 mb-12">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
            <History className="w-4 h-4 text-[#c9a227]" />
            Attività Recente
          </h2>
          <div className="space-y-4">
            {history.length > 0 ? (
              history.map((log) => (
                <div key={log.id} className="flex justify-between items-center py-4 border-b border-white/5 group hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                  <div>
                    <p className="font-bold text-sm tracking-tight capitalize">{log.description || (log.event_type === 'earn' ? 'Punti Accumulati' : 'Sconto Riscattato')}</p>
                    <p className="text-[10px] text-gray-500 font-medium">
                      {new Date(log.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-sm font-black tabular-nums tracking-tighter ${log.points_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {log.points_delta > 0 ? '+' : ''}{log.points_delta}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic text-center py-8">Nessun movimento registrato</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="pb-10 pt-4 text-center border-t border-white/5 bg-[#0f172a]">
        <p className="text-[10px] uppercase tracking-[0.3em] font-black italic text-gray-600">SvaPro Loyalty Hub</p>
      </div>
    </div>
  );
}
