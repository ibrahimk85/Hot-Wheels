// app/variants/page.tsx

import Image from 'next/image';

import { getVariants } from '@/features/variants/variant.service';



type VariantsPageProps = {

  searchParams?: { [key: string]: string | string[] | undefined };

};



export default async function VariantsPage({ searchParams = {} }: VariantsPageProps) {

  // URL parametrelerini oku

  const qParam = searchParams.q;

  const thParam = searchParams.th;

  const sthParam = searchParams.sth;

  const ownedParam = searchParams.owned;

  const yearParam = searchParams.year;



  const search =

    typeof qParam === 'string' && qParam.trim().length > 0 ? qParam.trim() : undefined;



  const onlyTH = thParam === '1';

  const onlySTH = sthParam === '1';



  let ownedStatus: boolean | undefined;

  if (ownedParam === '1') ownedStatus = true;

  if (ownedParam === '0') ownedStatus = false;



  // Year parametresini parse et (default: 2025)

  const year = yearParam ? parseInt(typeof yearParam === 'string' ? yearParam : yearParam[0], 10) : 2025;



  const variants = await getVariants({

    year: isNaN(year) ? 2025 : year,

    search,

    onlyTH,

    onlySTH,

    ownedStatus,

    limit: 100, // ilk etapta 100 kayıt göster

    offset: 0,

  });



  return (

    <div className="space-y-4">

      <h2 className="text-xl font-semibold">Varyantlar ({year} Mainline)</h2>



      {/* Filtre formu */}

      <form method="GET" className="flex flex-wrap gap-4 items-end border p-3 rounded-md">

        <div className="flex flex-col">

          <label htmlFor="year" className="text-sm font-medium">

            Yıl

          </label>

          <select

            id="year"

            name="year"

            defaultValue={year.toString()}

            className="border rounded px-2 py-1 text-sm"

          >

            {Array.from({ length: 27 }, (_, i) => 2000 + i).map((y) => (

              <option key={y} value={y}>

                {y}

              </option>

            ))}

          </select>

        </div>



        <div className="flex flex-col">

          <label htmlFor="q" className="text-sm font-medium">

            Arama (Model Adı)

          </label>

          <input

            id="q"

            name="q"

            type="text"

            defaultValue={search ?? ''}

            className="border rounded px-2 py-1 text-sm"

            placeholder="Mazda, Tesla, Skyline…"

          />

        </div>



        <div className="flex flex-col">

          <span className="text-sm font-medium">Özel Seriler</span>

          <label className="text-xs flex items-center gap-1">

            <input

              type="checkbox"

              name="th"

              value="1"

              defaultChecked={onlyTH}

            />

            Treasure Hunt

          </label>

          <label className="text-xs flex items-center gap-1">

            <input

              type="checkbox"

              name="sth"

              value="1"

              defaultChecked={onlySTH}

            />

            Super Treasure Hunt

          </label>

        </div>



        <div className="flex flex-col">

          <label htmlFor="owned" className="text-sm font-medium">

            Sahiplik

          </label>

          <select

            id="owned"

            name="owned"

            defaultValue={

              ownedStatus === true ? '1' : ownedStatus === false ? '0' : ''

            }

            className="border rounded px-2 py-1 text-sm"

          >

            <option value="">Hepsi</option>

            <option value="1">Sahip Olduklarım</option>

            <option value="0">Eksik Olanlar</option>

          </select>

        </div>



        <button

          type="submit"

          className="px-3 py-1 border rounded bg-black text-white text-sm"

        >

          Filtrele

        </button>

      </form>



      {/* Varyant listesi */}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">

        {variants.map((variant: any) => {

          const v = variant;

          const model = v.model;

          const subSeries = model?.subSeries;

          const collection = subSeries?.collection;

          const img = v.images?.[0];



          return (

            <article

              key={v.id}

              className="border rounded-md p-2 flex flex-col gap-2 text-sm"

            >

              {img?.path ? (

                <div className="relative w-full h-40 bg-gray-100">

                  <Image

                    src={img.path}

                    alt={img.alt ?? model?.castingName ?? 'Hot Wheels'}

                    fill

                    className="object-contain"

                  />

                </div>

              ) : (

                <div className="w-full h-40 flex items-center justify-center bg-gray-100 text-xs">

                  Görsel yok

                </div>

              )}



              <div className="space-y-1">

                <div className="font-semibold">

                  {model?.castingName ?? 'Bilinmeyen Model'}

                </div>

                <div>

                  <span className="font-mono text-xs">

                    #{v.cardNumber ?? '—'}

                  </span>{' '}

                  <span className="text-xs text-gray-600">

                    {collection?.name ?? ''} {subSeries ? `• ${subSeries.name}` : ''}

                  </span>

                </div>

                <div className="flex flex-wrap gap-1 text-[10px]">

                  {v.isTreasureHunt && (

                    <span className="px-2 py-0.5 rounded bg-green-200 font-semibold">

                      TH

                    </span>

                  )}

                  {v.isSuperTreasureHunt && (

                    <span className="px-2 py-0.5 rounded bg-purple-200 font-semibold">

                      STH

                    </span>

                  )}

                  {v.owned && (

                    <span className="px-2 py-0.5 rounded bg-blue-200">

                      Sende var

                    </span>

                  )}

                  {typeof v.quantity === 'number' && v.quantity > 1 && (

                    <span className="px-2 py-0.5 rounded bg-yellow-200">

                      {v.quantity} adet

                    </span>

                  )}

                </div>

              </div>

            </article>

          );

        })}

      </div>



      {variants.length === 0 && (

        <p className="text-sm text-gray-600">

          Seçilen filtrelerle eşleşen kayıt bulunamadı.

        </p>

      )}

    </div>

  );

}
