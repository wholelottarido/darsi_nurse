"use client";

import { Menu } from "lucide-react";

import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { PerawatSession } from "@/lib/nurse-auth";

type MobileSidebarSheetProps = {
  perawat: PerawatSession;
};

export default function MobileSidebarSheet({ perawat }: MobileSidebarSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Buka menu"
          className="h-8 w-8 border-slate-300 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] border-slate-300 p-2">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <Sidebar perawat={perawat} className="h-full w-full border-0" />
      </SheetContent>
    </Sheet>
  );
}
