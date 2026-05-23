'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Patient {
  id: string;
  nama: string;
  usia: number;
  jenis_kelamin: string;
  tanggal_lahir: string;
  nomor_rekam_medis?: string;
  berat_badan?: number;
  tinggi_badan?: number;
  gol_darah?: string;
  alergi?: string;
  riwayat_penyakit?: string;
}

interface ChatMessage {
  id?: number;
  role: 'user' | 'agent';
  message: string;
  timestamp?: string;
}

export default function PatientChatPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.patientId as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load patient data and messages
  useEffect(() => {
    setError(null);
    setMessages([]); // Clear messages when switching patient
    fetchPatientData();
    fetchMessages();
  }, [patientId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchPatientData() {
    try {
      const response = await fetch('/api', {
        method: 'GET',
      });

      if (!response.ok) throw new Error('Failed to fetch patients');

      const data = await response.json();
      const foundPatient = data.patients?.find((p: Patient) => p.id === patientId);

      if (!foundPatient) {
        throw new Error('Patient not found');
      }

      setPatient(foundPatient);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching patient:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages() {
    try {
      // This would typically call an API to get conversation history
      // For now, we'll just leave it empty (messages will be added during chat)
      setMessages([]);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !patientId) return;

    const messageToSend = inputMessage; // Save message BEFORE clearing

    const userMessage: ChatMessage = {
      role: 'user',
      message: messageToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage(''); // Clear AFTER saving
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend, // Use saved message
          patientId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      const agentMessage: ChatMessage = {
        role: 'agent',
        message: data.message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      const agentMessage: ChatMessage = {
        role: 'agent',
        message: `Error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMessage]);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-[#059669] mx-auto mb-4" />
          <p className="text-slate-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (!patient || error) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800 mb-4">Error: {error || 'Patient not found'}</p>
          <Link
            href="/triage-igd"
            className="inline-block rounded-lg bg-[#059669] px-6 py-2 text-white hover:bg-[#047857]"
          >
            Back to Patient List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/triage-igd"
              className="text-slate-600 hover:text-slate-900"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{patient.nama}</h1>
              <p className="text-sm text-slate-600">NRM: {patient.nomor_rekam_medis || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#059669]/10 px-3 py-1 text-sm font-medium text-[#059669]">
              {patient.jenis_kelamin === 'M' ? 'Laki-laki' : 'Perempuan'}
            </span>
            <span className="text-sm text-slate-600">{patient.usia} tahun</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Patient Info */}
        <div className="w-80 border-r border-slate-200 bg-white p-6 overflow-y-auto">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Clinical Summary</h2>

          <div className="space-y-4">
            {/* Vital Signs */}
            <div className="rounded-lg bg-slate-50 p-4">
              <h3 className="mb-3 font-medium text-slate-900">Vital Signs</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Usia</span>
                  <span className="font-medium">{patient.usia} tahun</span>
                </div>
                {patient.berat_badan && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Berat Badan</span>
                    <span className="font-medium">{patient.berat_badan} kg</span>
                  </div>
                )}
                {patient.tinggi_badan && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tinggi Badan</span>
                    <span className="font-medium">{patient.tinggi_badan} cm</span>
                  </div>
                )}
                {patient.berat_badan && patient.tinggi_badan && (
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-600">BMI</span>
                    <span className="font-medium">
                      {(patient.berat_badan / ((patient.tinggi_badan / 100) ** 2)).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Blood Type */}
            {patient.gol_darah && (
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="mb-3 font-medium text-slate-900">Blood Type</h3>
                <div className="inline-block rounded-full bg-red-100 px-4 py-2 font-bold text-red-700">
                  {patient.gol_darah}
                </div>
              </div>
            )}

            {/* Allergies */}
            {patient.alergi && (
              <div className="rounded-lg border-l-4 border-orange-400 bg-orange-50 p-4">
                <h3 className="mb-2 font-medium text-orange-900">⚠️ Allergies</h3>
                <p className="text-sm text-orange-800">{patient.alergi}</p>
              </div>
            )}

            {/* Medical History */}
            {patient.riwayat_penyakit && (
              <div className="rounded-lg bg-slate-50 p-4">
                <h3 className="mb-3 font-medium text-slate-900">Medical History</h3>
                <p className="text-sm text-slate-700">{patient.riwayat_penyakit}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Main Area - Chat */}
        <div className="flex flex-1 flex-col">
          {/* Tabs */}
          <div className="border-b border-slate-200 bg-white px-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('chat')}
                className={`border-b-2 px-4 py-4 font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'border-[#059669] text-[#059669]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Triage Chat
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`border-b-2 px-4 py-4 font-medium transition-colors ${
                  activeTab === 'notes'
                    ? 'border-[#059669] text-[#059669]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Clinical Notes
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          {activeTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <p className="text-slate-500 mb-2">Welcome to Triage Chat</p>
                        <p className="text-sm text-slate-400">
                          Start a conversation to assess this patient's condition
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md rounded-lg px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-[#059669] text-white'
                            : 'border border-slate-200 bg-white text-slate-900'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        {msg.timestamp && (
                          <p
                            className={`mt-1 text-xs ${
                              msg.role === 'user'
                                ? 'text-[#059669]/70'
                                : 'text-slate-400'
                            }`}
                          >
                            {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="border-t border-slate-200 bg-white p-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !sending) {
                        sendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={sending}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#059669]/20 disabled:bg-slate-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !inputMessage.trim()}
                    className="rounded-lg bg-[#059669] px-6 py-3 font-medium text-white hover:bg-[#047857] disabled:bg-slate-300 transition-colors"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Clinical Notes Tab */}
          {activeTab === 'notes' && (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-lg bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Clinical Assessment Notes
                </h3>

                <div className="prose prose-sm max-w-none">
                  <p className="text-slate-600">
                    Clinical recommendations and assessment notes from the Triage Agent will appear here.
                  </p>

                  {messages.filter((m) => m.role === 'agent').length > 0 && (
                    <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
                      <h4 className="font-medium text-slate-900">Agent Assessments:</h4>
                      <div className="space-y-3">
                        {messages
                          .filter((m) => m.role === 'agent')
                          .map((msg, idx) => (
                            <div key={idx} className="rounded-lg bg-slate-50 p-4">
                              <p className="text-sm text-slate-700">{msg.message}</p>
                              {msg.timestamp && (
                                <p className="mt-2 text-xs text-slate-500">
                                  {new Date(msg.timestamp).toLocaleString('id-ID')}
                                </p>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}