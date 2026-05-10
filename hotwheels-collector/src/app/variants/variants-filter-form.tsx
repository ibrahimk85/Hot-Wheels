"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface VariantsFilterFormProps {
  years: Array<{ id: number; year: number }>
  collectionsForYear: Array<{ id: number | string; name: string }>
  subSeriesForCollection: Array<{ id: number; name: string }>
  categoriesForCollection?: Array<{ id: string; name: string }> // Silver Series: 1st level (Anniversary)
  selectedCategory?: string
  selectedSubSeriesName?: string
  selectedYear?: number
  collectionName?: string
  collectionId?: number
  subSeriesId?: number
  search?: string
  onlyTH: boolean
  onlySTH: boolean
  packedOwnedStatus?: boolean
  looseOwnedStatus?: boolean
  wishlistedStatus?: boolean
}

export default function VariantsFilterForm({
  years,
  collectionsForYear,
  subSeriesForCollection,
  categoriesForCollection = [],
  selectedCategory,
  selectedSubSeriesName,
  selectedYear,
  collectionName,
  collectionId,
  subSeriesId,
  search,
  onlyTH,
  onlySTH,
  packedOwnedStatus,
  looseOwnedStatus,
  wishlistedStatus,
}: VariantsFilterFormProps) {
  const router = useRouter()
  const [year, setYear] = useState(selectedYear ? selectedYear.toString() : "all")
  const [collection, setCollection] = useState(collectionName ?? "all")
  const isSilverSeries = collectionName === 'Hot Wheels Silver Series'
  const [category, setCategory] = useState(isSilverSeries ? (selectedCategory ?? "all") : "all")
  const [subSeries, setSubSeries] = useState(
    isSilverSeries ? (selectedSubSeriesName ?? "all") : (subSeriesId?.toString() ?? "all")
  )

  const isBoulevard = collectionName === 'Boulevard'

  const handleYearChange = (newYear: string) => {
    setYear(newYear)
    setSubSeries("all")
  }

  const handleCollectionChange = (newCollection: string) => {
    setCollection(newCollection)
    setCategory("all")
    setSubSeries("all")
  }

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory)
    setSubSeries("all")
  }
  const [packedOwned, setPackedOwned] = useState(
    packedOwnedStatus === true ? "1" : packedOwnedStatus === false ? "0" : "all"
  )
  const [looseOwned, setLooseOwned] = useState(
    looseOwnedStatus === true ? "1" : looseOwnedStatus === false ? "0" : "all"
  )
  const [wish, setWish] = useState(
    wishlistedStatus === true ? "1" : wishlistedStatus === false ? "0" : "all"
  )
  const [searchQuery, setSearchQuery] = useState(search ?? "")
  const [th, setTh] = useState(onlyTH)
  const [sth, setSth] = useState(onlySTH)
  const [debouncedSearch, setDebouncedSearch] = useState(search ?? "")

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (collectionName && collectionName !== collection) {
      setCollection(collectionName);
    } else if (!collectionName && collection !== "all") {
      setCollection("all");
    }
  }, [collectionName])

  useEffect(() => {
    if (isSilverSeries && selectedCategory !== undefined && selectedCategory !== category) {
      setCategory(selectedCategory);
    }
  }, [selectedCategory, isSilverSeries])

  useEffect(() => {
    if (isSilverSeries && selectedSubSeriesName !== undefined && selectedSubSeriesName !== subSeries) {
      setSubSeries(selectedSubSeriesName);
    }
  }, [selectedSubSeriesName, isSilverSeries])

  useEffect(() => {
    const params = new URLSearchParams()

    if (year && year !== "all") params.set("year", year)
    if (collection && collection !== "all") params.set("collection", collection)
    if (isSilverSeries && category && category !== "all") params.set("category", category)
    if (subSeries && subSeries !== "all") params.set("subSeries", subSeries)

    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())

    // TH/STH filtreleri sadece Boulevard değilse aktif
    if (!isBoulevard) {
      if (th) params.set("th", "1")
      if (sth) params.set("sth", "1")
    }

    if (packedOwned && packedOwned !== "all") params.set("packedOwned", packedOwned)
    if (looseOwned && looseOwned !== "all") params.set("looseOwned", looseOwned)
    if (wish && wish !== "all") params.set("wish", wish)

    router.push(`/variants?${params.toString()}`)
  }, [year, collection, category, subSeries, debouncedSearch, th, sth, packedOwned, looseOwned, wish, isSilverSeries, isBoulevard, router])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="year">Yıl</Label>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger id="year" className="w-[140px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y.id} value={y.year.toString()}>
                    {y.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="collection">Koleksiyon</Label>
            <Select value={collection} onValueChange={handleCollectionChange}>
              <SelectTrigger id="collection" className="w-[180px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                {collectionsForYear.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Silver Series: 1st Alt Seri (Anniversary) - sadece Silver Series seçildiğinde */}
          {collection && collection !== "all" && isSilverSeries && categoriesForCollection.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Alt Seri</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger id="category" className="w-[180px]">
                  <SelectValue placeholder="Hepsi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hepsi</SelectItem>
                  {categoriesForCollection.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Silver Series: 2nd Alt Seri (Purple/Blue and Gold) - sadece Anniversary seçildiğinde */}
          {collection && collection !== "all" && isSilverSeries && category !== "all" && subSeriesForCollection.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="subSeries">Seri</Label>
              <Select value={subSeries} onValueChange={setSubSeries}>
                <SelectTrigger id="subSeries" className="w-[180px]">
                  <SelectValue placeholder="Hepsi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hepsi</SelectItem>
                  {subSeriesForCollection.map((ss, idx) => (
                    <SelectItem key={ss.id || idx} value={ss.name}>
                      {ss.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Diğer koleksiyonlar: Tek Alt Seri */}
          {collection && collection !== "all" && !isSilverSeries && subSeriesForCollection.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="subSeries">Alt Seri</Label>
              <Select value={subSeries} onValueChange={setSubSeries}>
                <SelectTrigger id="subSeries" className="w-[180px]">
                  <SelectValue placeholder="Hepsi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hepsi</SelectItem>
                  {subSeriesForCollection.map((ss) => (
                    <SelectItem key={ss.id} value={ss.id.toString()}>
                      {ss.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="q">Arama (Model Adı veya COL#)</Label>
            <Input
              id="q"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mazda, COL#123, Skyline…"
              className="w-[200px]"
            />
          </div>

          {/* TH/STH filtreleri - Boulevard'da gösterilmez */}
          {!isBoulevard && (
            <div className="flex flex-col gap-2">
              <Label>Özel Seriler</Label>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="th"
                    checked={th}
                    onCheckedChange={(checked) => setTh(checked === true)}
                  />
                  <Label htmlFor="th" className="text-sm font-normal cursor-pointer">
                    Treasure Hunt
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sth"
                    checked={sth}
                    onCheckedChange={(checked) => setSth(checked === true)}
                  />
                  <Label htmlFor="sth" className="text-sm font-normal cursor-pointer">
                    Super Treasure Hunt
                  </Label>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="packedOwned">Packed</Label>
            <Select value={packedOwned} onValueChange={setPackedOwned}>
              <SelectTrigger id="packedOwned" className="w-[160px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Packed Olanlar</SelectItem>
                <SelectItem value="0">Packed Olmayanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="looseOwned">Loose</Label>
            <Select value={looseOwned} onValueChange={setLooseOwned}>
              <SelectTrigger id="looseOwned" className="w-[160px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Loose Olanlar</SelectItem>
                <SelectItem value="0">Loose Olmayanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="wish">Wish</Label>
            <Select value={wish} onValueChange={setWish}>
              <SelectTrigger id="wish" className="w-[180px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Wish'teki</SelectItem>
                <SelectItem value="0">Wish'te olmayanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}




