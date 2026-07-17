import { InfoHint } from "@/components/InfoHint"

/**
 * Explicaciones de los dos conceptos que un usuario nuevo puede no conocer. El
 * texto vive aquí una sola vez y se ancla junto a cada concepto (Análisis,
 * diálogo de presupuesto, Inicio y Colchón), para no repetirlo ni que se
 * desincronice.
 */

export function Rule503020Hint() {
  return (
    <InfoHint label="Qué es la regla 50-30-20" title="La regla 50-30-20">
      <p>
        Una forma sencilla de repartir lo que ingresas cada mes, popularizada por
        la economista Elizabeth Warren. Divide el dinero en tres:
      </p>
      <ul className="ml-1 space-y-1">
        <li>
          <span className="font-medium text-bucket-living">Vida (50%)</span> — lo que no
          puedes evitar: vivienda, comida, suministros.
        </li>
        <li>
          <span className="font-medium text-bucket-monthly">Mes (30%)</span> — lo que
          decides: ocio, ropa, caprichos.
        </li>
        <li>
          <span className="font-medium text-invest">Inversión (20%)</span> — lo que
          apartas para tu futuro.
        </li>
      </ul>
      <p>
        Los porcentajes son un punto de partida, no una imposición: ajústalos en
        «Ajustar presupuesto» a lo que encaje con tu vida.
      </p>
    </InfoHint>
  )
}

export function EmergencyFundHint() {
  return (
    <InfoHint label="Qué es el colchón de emergencia" title="El colchón de emergencia">
      <p>
        Un ahorro reservado para los imprevistos —una avería, quedarte sin
        trabajo— que convierte un susto en una molestia en vez de en un problema.
      </p>
      <p>
        Lo habitual es cubrir de <span className="font-medium">3 a 6 meses</span> de
        tus gastos de vida: cuantos más, más tranquilidad. Aquí defines cuánto
        necesitas para vivir al mes y cuántos meses quieres cubrir, y Numario
        calcula el objetivo y sigue tu progreso.
      </p>
      <p>El dinero del colchón no cuenta como gasto: es un traspaso a tu ahorro.</p>
    </InfoHint>
  )
}
