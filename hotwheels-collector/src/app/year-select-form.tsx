"use client"

import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface YearSelectFormProps {
  years: Array<{ id: number; year: number }>
  selectedYear: number | undefined
}

export default function YearSelectForm({ years, selectedYear }: YearSelectFormProps) {
  const router = useRouter()

  const handleYearChange = (value: string) => {
    if (value === 'all') {
      router.push('/')
    } else {
      router.push(`/?year=${value}`)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={selectedYear ? selectedYear.toString() : 'all'} 
        onValueChange={handleYearChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Yıl seç" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tümü</SelectItem>
          {years.map((y) => (
            <SelectItem key={y.id} value={y.year.toString()}>
              {y.year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}




