export type Produto = {
  id: string;
  nome: string;
  categoria: string | null;
  preco: number;
  quantidade: number;
  estoque_minimo: number;
  estoque_baixo: boolean;
  created_at: string;
};

export type Resumo = { total_produtos: number; em_alerta: number; valor_total: number };

export type Movimentacao = {
  id: string;
  produto_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  observacao: string | null;
  created_at: string;
};

export const resumoVazio: Resumo = { total_produtos: 0, em_alerta: 0, valor_total: 0 };
