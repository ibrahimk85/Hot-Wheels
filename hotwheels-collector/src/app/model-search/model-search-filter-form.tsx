"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ModelSearchFilterFormProps {
  years: Array<{ id: number; year: number }>
  collectionsForYear: Array<{ id: number; name: string }>
  subSeriesForCollection: Array<{ id: number; name: string }>
  selectedYear: number
  collectionId?: number
  subSeriesId?: number
  search?: string
  ownedStatus?: boolean
  wishlistedStatus?: boolean
}

export default function ModelSearchFilterForm({
  years,
  collectionsForYear,
  subSeriesForCollection,
  selectedYear,
  collectionId,
  subSeriesId,
  search,
  ownedStatus,
  wishlistedStatus,
}: ModelSearchFilterFormProps) {
  const router = useRouter()
  const [year, setYear] = useState(selectedYear.toString())
  const [collection, setCollection] = useState(collectionId?.toString() ?? "all")
  const [subSeries, setSubSeries] = useState(subSeriesId?.toString() ?? "all")
  const [owned, setOwned] = useState(
    ownedStatus === true ? "1" : ownedStatus === false ? "0" : "all"
  )
  const [wish, setWish] = useState(
    wishlistedStatus === true ? "1" : wishlistedStatus === false ? "0" : "all"
  )
  const [searchQuery, setSearchQuery] = useState(search ?? "")
  const [debouncedSearch, setDebouncedSearch] = useState(search ?? "")

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Yıl değiştiğinde - Her filtre birbirinden bağımsız çalışmalı
  const handleYearChange = (newYear: string) => {
    setYear(newYear)
    setSubSeries("all")
  }

  // Koleksiyon değiştiğinde - Her filtre birbirinden bağımsız çalışmalı
  const handleCollectionChange = (newCollection: string) => {
    setCollection(newCollection)
    setSubSeries("all")
  }

  // Server-side'dan gelen collectionId'yi client-side state ile senkronize et
  useEffect(() => {
    if (collectionId && collectionsForYear.length > 0) {
      const collectionInYear = collectionsForYear.find(c => c.id === collectionId);
      if (collectionInYear && collectionInYear.id.toString() !== collection) {
        setCollection(collectionId.toString());
      }
    }
  }, [collectionId, collectionsForYear])

  // Update URL when any filter changes
  useEffect(() => {
    const params = new URLSearchParams()

    if (year) params.set("year", year)

    if (collection && collection !== "all") params.set("collection", collection)
    if (subSeries && subSeries !== "all") params.set("subSeries", subSeries)

    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim())

    if (owned && owned !== "all") params.set("owned", owned)
    if (wish && wish !== "all") params.set("wish", wish)

    router.push(`/model-search?${params.toString()}`)
  }, [year, collection, subSeries, debouncedSearch, owned, wish, router])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="year">Yıl</Label>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger id="year" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alt Seri Seçimi - Sadece koleksiyon seçildiğinde göster */}
          {collection && collection !== "all" && subSeriesForCollection.length > 0 && (
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
            <Label htmlFor="q">Arama (Model Adı)</Label>
            <Input
              id="q"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mazda, Skyline…"
              className="w-[200px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owned">Sahiplik</Label>
            <Select value={owned} onValueChange={setOwned}>
              <SelectTrigger id="owned" className="w-[160px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Sahip Olduklarım</SelectItem>
                <SelectItem value="0">Eksik Olanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="wish">Wishlist</Label>
            <Select value={wish} onValueChange={setWish}>
              <SelectTrigger id="wish" className="w-[180px]">
                <SelectValue placeholder="Hepsi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Hepsi</SelectItem>
                <SelectItem value="1">Wishlist'tekiler</SelectItem>
                <SelectItem value="0">Wishlist'te olmayanlar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}








