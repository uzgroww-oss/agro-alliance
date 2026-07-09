import { Link } from "react-router-dom"
import { Reveal, Icon, I } from "../lib/ui"

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-5 text-center">
      <Reveal>
        <div>
          <span className="mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-soft text-green">
            <Icon d={I.question} className="h-12 w-12" />
          </span>
          <h1 className="mt-6 font-display text-6xl font-extrabold text-green">404</h1>
          <h2 className="mt-2 font-display text-xl font-bold">Sahifa topilmadi</h2>
          <p className="mt-3 max-w-md text-muted">
            Siz qidirgan sahifa mavjud emas yoki o'chirilgan bo'lishi mumkin.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-green px-7 py-3.5 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105"
          >
            <Icon d={I.home} className="h-5 w-5" /> BOSH SAHIFA
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
