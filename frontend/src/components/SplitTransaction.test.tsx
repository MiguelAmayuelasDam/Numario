import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SplitTransaction } from "@/components/SplitTransaction"
import type { Transaction } from "@/lib/api"

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, statusText: "", json: async () => body } as Response
}

const transaction: Transaction = {
  id: "t1",
  amount: "7.70",
  type: "expense",
  concept: "Konogan",
  occurred_on: "2026-07-03",
  category_id: null,
  category: null,
  source: "manual",
  created_at: "2026-07-03T00:00:00Z",
}

function renderSplit(onDone = vi.fn()) {
  render(
    <SplitTransaction
      transaction={transaction}
      categories={[]}
      onDone={onDone}
      onCancel={vi.fn()}
    />,
  )
  return onDone
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => localStorage.setItem("numario.access", "ACC"))

describe("SplitTransaction", () => {
  it("bloquea Dividir cuando las partes no suman el total", async () => {
    renderSplit()
    const user = userEvent.setup()
    const amounts = screen.getAllByLabelText(/Importe parte/)
    await user.type(amounts[0], "4.70")
    await user.type(amounts[1], "2.00") // suma 6,70 ≠ 7,70

    expect(screen.getByText(/Te falta/)).toHaveTextContent("1,00")
    expect(screen.getByRole("button", { name: "Dividir" })).toBeDisabled()
  })

  it("permite dividir cuando las partes cuadran y llama a la API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, []))
    vi.stubGlobal("fetch", fetchMock)
    const onDone = renderSplit()
    const user = userEvent.setup()

    const amounts = screen.getAllByLabelText(/Importe parte/)
    await user.type(amounts[0], "4.70")
    await user.type(amounts[1], "3.00") // suma 7,70 = total

    const dividir = screen.getByRole("button", { name: "Dividir" })
    expect(dividir).toBeEnabled()
    await user.click(dividir)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain("/transactions/t1/split")
    expect(JSON.parse((init as RequestInit).body as string).parts).toHaveLength(2)
    expect(onDone).toHaveBeenCalled()
  })
})
