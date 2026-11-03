"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (!email.trim() || !senha) {
      setErro("Informe e-mail e senha.");
      return;
    }
    if (modo === "cadastrar" && senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    const supabase = createClient();

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setCarregando(false);
      if (error) {
        setErro("E-mail ou senha incorretos.");
        return;
      }
      router.replace("/");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      setCarregando(false);
      if (error) {
        setErro("Não foi possível criar a conta: " + error.message);
        return;
      }
      if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setAviso("Conta criada! Confirme o cadastro pelo link enviado ao seu e-mail e depois entre.");
        setModo("entrar");
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-2xl font-bold text-white">
            E
          </div>
          <h1 className="text-2xl font-semibold">Estoque Fácil</h1>
          <p className="mt-1 text-sm text-slate-500">
            {modo === "entrar" ? "Entre para gerenciar seu estoque" : "Crie sua conta gratuita"}
          </p>
        </div>

        {erro && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </div>
        )}
        {aviso && (
          <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {aviso}
          </div>
        )}

        <form onSubmit={enviar} className="space-y-4" noValidate>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">E-mail</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Senha</span>
            <input
              type="password"
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {carregando ? "Aguarde..." : modo === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          {modo === "entrar" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setModo(modo === "entrar" ? "cadastrar" : "entrar");
              setErro(null);
              setAviso(null);
            }}
            className="font-medium text-emerald-700 hover:underline"
          >
            {modo === "entrar" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}
