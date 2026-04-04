// src/contexts/CaseContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface Case {
  id: string;
  title: string;
  description: string;
  fragment_count: number;
}

interface CaseContextType {
  activeCaseId: string | null;
  activeCaseName: string;
  cases: Case[];
  setActiveCaseId: (id: string | null) => void;
  createNewCase: (title?: string) => Promise<string>;
  deleteCase: (id: string) => Promise<void>;
  refreshCases: () => Promise<void>;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const CaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const refreshCases = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/cases?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setCases(data);
        if (data.length > 0 && !activeCaseId) {
          setActiveCaseId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err);
    }
  };

  const createNewCase = async (title: string = "Untitled Case") => {
    try {
      const res = await fetch(`${API_BASE_URL}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: "" }),
      });
      if (res.ok) {
        const newCase = await res.json();
        await refreshCases();
        setActiveCaseId(newCase.id);
        return newCase.id;
      }
    } catch (err) {
      console.error("Failed to create new case:", err);
    }
    return "";
  };

  const deleteCase = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${id}`, { method: "DELETE" });
      if (res.ok) {
        await refreshCases();
        if (activeCaseId === id) {
          // Default to the next available case, or null
          const dataRes = await fetch(`${API_BASE_URL}/cases?t=${Date.now()}`);
          if (dataRes.ok) {
            const data = await dataRes.json();
            setActiveCaseId(data.length > 0 ? data[0].id : null);
          } else {
            setActiveCaseId(null);
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete case:", err);
    }
  };

  useEffect(() => {
    refreshCases();
  }, []);

  const activeCaseName = cases.find(c => c.id === activeCaseId)?.title || "Untitled Case";

  return (
    <CaseContext.Provider value={{ activeCaseId, activeCaseName, cases, setActiveCaseId, createNewCase, deleteCase, refreshCases }}>
      {children}
    </CaseContext.Provider>
  );
};

export const useCaseContext = () => {
  const context = useContext(CaseContext);
  if (!context) throw new Error("useCaseContext must be used within a CaseProvider");
  return context;
};