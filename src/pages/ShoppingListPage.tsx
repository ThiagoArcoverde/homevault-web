import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { FileCode2, FileText, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Search, Trash2 } from 'lucide-react'
import {
  clearPurchasedShoppingItems,
  createShoppingItem,
  deleteShoppingItem,
  getShoppingCategories,
  getShoppingExportData,
  getShoppingPage,
  updateShoppingItem,
  type ShoppingCategory as ApiShoppingCategory,
  type ShoppingItem as ApiShoppingItem,
  type ShoppingPage as ApiShoppingPage,
} from '../api/shoppingList'

const shoppingItemsPerPage = 4

type ShoppingCategory = string

type ShoppingItem = {
  id: string
  name: string
  quantity: number
  category: ShoppingCategory
  categoryId?: string
  purchased: boolean
}

type PendingRemoval =
  | { type: 'item'; item: ShoppingItem }
  | { type: 'purchased' }

type PageTransition = {
  id: number
  outgoingItems: ShoppingItem[]
  incomingItems: ShoppingItem[]
  direction: 1 | -1
  phase: 'preparing' | 'moving'
}

type ExportValue = string | number

function getExportRows(items: ShoppingItem[], categories: ApiShoppingCategory[]): ExportValue[][] {
  const categoryOrder = new Map(categories.map((category) => [category.id, category.sortOrder] as const))
  const orderedItems = [...items].sort((firstItem, secondItem) => {
    const firstCategoryOrder = categoryOrder.get(firstItem.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER
    const secondCategoryOrder = categoryOrder.get(secondItem.categoryId ?? '') ?? Number.MAX_SAFE_INTEGER

    if (firstCategoryOrder !== secondCategoryOrder) {
      return firstCategoryOrder - secondCategoryOrder
    }

    const categoryComparison = firstItem.category.localeCompare(secondItem.category, 'pt-BR', { sensitivity: 'base' })
    return categoryComparison || firstItem.name.localeCompare(secondItem.name, 'pt-BR', { sensitivity: 'base' })
  })

  return [
    ['Produto', 'Quantidade', 'Categoria', 'Status'],
    ...orderedItems.map((item) => [
      item.name,
      item.quantity,
      item.category,
      item.purchased ? 'Comprado' : 'Pendente',
    ]),
  ]
}

function mapApiItem(item: ApiShoppingItem): ShoppingItem {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    category: item.category.name,
    categoryId: item.category.id,
    purchased: item.purchased,
  }
}

function formatExportDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function escapeCsvCell(value: string | number): string {
  const text = String(value)
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text

  return `"${safeText.replace(/"/g, '""')}"`
}

function escapeMarkdownCell(value: ExportValue): string {
  return String(value).replace(/[\r\n]+/g, ' ').replace(/[\\|]/g, '\\$&')
}

function downloadFile(contents: BlobPart, fileName: string, contentType: string): void {
  const file = new Blob([contents], { type: contentType })
  const objectUrl = URL.createObjectURL(file)
  const downloadLink = document.createElement('a')

  downloadLink.href = objectUrl
  downloadLink.download = fileName
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [pageData, setPageData] = useState<ApiShoppingPage | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listRetry, setListRetry] = useState(0)
  const [pageTransition, setPageTransition] = useState<PageTransition | null>(null)
  const [isTrackResetting, setIsTrackResetting] = useState(false)
  const [categories, setCategories] = useState<ApiShoppingCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [categoriesRetry, setCategoriesRetry] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmittingItem, setIsSubmittingItem] = useState(false)
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null)
  const [isClearingPurchased, setIsClearingPurchased] = useState(false)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [categoryId, setCategoryId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ShoppingCategory | 'all'>('all')
  const [productPage, setProductPage] = useState(0)
  const [isComposerOpen, setIsComposerOpen] = useState(true)
  const [newlyAddedItemId, setNewlyAddedItemId] = useState<string | null>(null)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const pageDataRef = useRef<ApiShoppingPage | null>(null)
  const pageFilterKeyRef = useRef<string | null>(null)
  const pageTransitionIdRef = useRef(0)
  const productTouchStart = useRef<{ x: number; y: number } | null>(null)
  const suppressSwipeClick = useRef(false)
  const [productDragOffset, setProductDragOffset] = useState(0)
  const [isDraggingProducts, setIsDraggingProducts] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false

    setIsLoadingCategories(true)
    setCategoriesError(null)
    void getShoppingCategories(controller.signal)
      .then((response) => {
        if (disposed) return
        setCategories(response.categories)
        setCategoryId((currentCategoryId) =>
          response.categories.some((shoppingCategory) => shoppingCategory.id === currentCategoryId)
            ? currentCategoryId
            : response.categories[0]?.id ?? '',
        )
      })
      .catch((error: unknown) => {
        if (!disposed && !controller.signal.aborted) {
          setCategoriesError(error instanceof Error ? error.message : 'Não foi possível carregar categorias.')
        }
      })
      .finally(() => {
        if (!disposed) setIsLoadingCategories(false)
      })

    return () => {
      disposed = true
      controller.abort()
    }
  }, [categoriesRetry])

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    const filterKey = JSON.stringify([searchQuery.trim(), categoryFilter])
    const requestedPage = productPage + 1

    setIsLoadingList(true)
    setListError(null)
    void getShoppingPage({
      search: searchQuery,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      page: requestedPage,
      pageSize: shoppingItemsPerPage,
    }, controller.signal)
      .then((response) => {
        if (disposed) return

        const previousPage = pageDataRef.current
        const canSlide = Boolean(
          previousPage &&
          pageFilterKeyRef.current === filterKey &&
          Math.abs(response.page - previousPage.page) === 1 &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        )
        const incomingItems = response.items.map(mapApiItem)

        pageDataRef.current = response
        pageFilterKeyRef.current = filterKey
        setPageData(response)
        setItems(incomingItems)
        if (response.page !== requestedPage) setProductPage(response.page - 1)

        if (canSlide && previousPage) {
          const transitionId = ++pageTransitionIdRef.current
          setIsTrackResetting(false)
          setPageTransition({
            id: transitionId,
            outgoingItems: previousPage.items.map(mapApiItem),
            incomingItems,
            direction: response.page > previousPage.page ? 1 : -1,
            phase: 'preparing',
          })
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              setPageTransition((currentTransition) =>
                currentTransition?.id === transitionId
                  ? { ...currentTransition, phase: 'moving' }
                  : currentTransition,
              )
            })
          })
        } else {
          setPageTransition(null)
          setProductDragOffset(0)
          setIsDraggingProducts(false)
          setIsTrackResetting(false)
        }
      })
      .catch((error: unknown) => {
        if (!disposed && !controller.signal.aborted) {
          setListError(error instanceof Error ? error.message : 'Não foi possível carregar a lista.')
        }
      })
      .finally(() => {
        if (!disposed) setIsLoadingList(false)
      })

    return () => {
      disposed = true
      controller.abort()
    }
  }, [categoryFilter, listRetry, productPage, searchQuery])

  useEffect(() => {
    if (!isExportMenuOpen) {
      return
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !exportMenuRef.current?.contains(event.target)) {
        setIsExportMenuOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false)
        exportMenuRef.current
          ?.querySelector<HTMLButtonElement>('.homevault-shopping-export-trigger')
          ?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isExportMenuOpen])

  useEffect(() => {
    const dialog = deleteDialogRef.current

    if (!dialog) {
      return
    }

    if (pendingRemoval && !dialog.open) {
      dialog.showModal()
      dialog
        .querySelector<HTMLButtonElement>('.homevault-shopping-delete-cancel')
        ?.focus()
    } else if (!pendingRemoval && dialog.open) {
      dialog.close()
    }
  }, [pendingRemoval])

  useEffect(() => {
    if (!pendingRemoval) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setPendingRemoval(null)
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [pendingRemoval])

  const summary = pageData?.summary
  const purchasedCount = summary?.purchasedItems ?? 0
  const totalItems = summary?.totalItems ?? 0
  const totalMatchingItems = pageData?.totalMatchingItems ?? 0
  const hasActiveFilters = searchQuery.trim().length > 0 || categoryFilter !== 'all'
  const pageCount = pageData?.totalPages ?? 1
  const currentProductPage = pageData ? pageData.page - 1 : productPage
  const firstProductIndex = currentProductPage * shoppingItemsPerPage
  const visibleItems = items
  const renderedProductPages = pageTransition
    ? pageTransition.direction > 0
      ? [pageTransition.outgoingItems, pageTransition.incomingItems]
      : [pageTransition.incomingItems, pageTransition.outgoingItems]
    : [visibleItems]
  const activeRenderedPageIndex = pageTransition
    ? pageTransition.phase === 'preparing'
      ? pageTransition.direction > 0 ? 0 : 1
      : pageTransition.direction > 0 ? 1 : 0
    : 0
  const trackTransform = pageTransition
    ? pageTransition.phase === 'preparing'
      ? pageTransition.direction > 0
        ? `translateX(${productDragOffset}px)`
        : `translateX(calc(-100% + ${productDragOffset}px))`
      : pageTransition.direction > 0 ? 'translateX(-100%)' : 'translateX(0%)'
    : `translateX(${productDragOffset}px)`

  function changeProductPage(direction: 1 | -1) {
    setProductPage((currentPage) =>
      Math.max(0, Math.min(pageCount - 1, currentPage + direction)),
    )
  }

  function resetProductPage() {
    setProductPage(0)
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedName = itemName.trim()

    const selectedCategory = categories.find((shoppingCategory) => shoppingCategory.id === categoryId)

    if (!normalizedName || quantity < 1 || !selectedCategory) {
      return
    }

    setActionError(null)
    setIsSubmittingItem(true)
    try {
      const createdItem = await createShoppingItem({
        name: normalizedName,
        quantity,
        categoryId: selectedCategory.id,
      })
      const targetPage = Math.floor(totalItems / shoppingItemsPerPage)
      setSearchQuery('')
      setCategoryFilter('all')
      setProductPage(targetPage)
      setNewlyAddedItemId(createdItem.id)
      setListRetry((currentRetry) => currentRetry + 1)
      setItemName('')
      setQuantity(1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível adicionar o produto.')
    } finally {
      setIsSubmittingItem(false)
    }
  }

  async function togglePurchased(item: ShoppingItem) {
    setActionError(null)
    setUpdatingItemId(item.id)
    try {
      await updateShoppingItem(item.id, { purchased: !item.purchased })
      setListRetry((currentRetry) => currentRetry + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar o produto.')
    } finally {
      setUpdatingItemId(null)
    }
  }

  async function removeItem(itemId: string): Promise<boolean> {
    setActionError(null)
    setIsClearingPurchased(true)
    try {
      await deleteShoppingItem(itemId)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível excluir o produto.')
      return false
    } finally {
      setIsClearingPurchased(false)
    }

    const remainingFilteredCount = Math.max(0, totalMatchingItems - 1)
    const lastAvailablePage = Math.max(
      0,
      Math.ceil(remainingFilteredCount / shoppingItemsPerPage) - 1,
    )
    setProductPage((currentPage) => Math.min(currentPage, lastAvailablePage))
    setListRetry((currentRetry) => currentRetry + 1)
    return true
  }

  async function confirmPendingRemoval() {
    if (!pendingRemoval) {
      return
    }

    setActionError(null)
    let succeeded = false
    if (pendingRemoval.type === 'item') {
      succeeded = await removeItem(pendingRemoval.item.id)
    } else {
      succeeded = await clearPurchasedItems()
    }

    if (succeeded) setPendingRemoval(null)
  }

  async function clearPurchasedItems(): Promise<boolean> {
    setActionError(null)
    setIsClearingPurchased(true)
    try {
      await clearPurchasedShoppingItems()
      setProductPage(0)
      setListRetry((currentRetry) => currentRetry + 1)
      return true
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível limpar os produtos comprados.')
      return false
    } finally {
      setIsClearingPurchased(false)
    }
  }

  async function runExport(exportAction: () => Promise<void>) {
    setActionError(null)
    setIsExportMenuOpen(false)
    try {
      await exportAction()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível exportar a lista.')
    }
  }

  async function exportItems() {
    const snapshot = await getShoppingExportData()
    const exportItems = snapshot.items.map(mapApiItem)
    const [header, ...itemRows] = getExportRows(exportItems, categories)
    const exportedAt = formatExportDate(new Date())
    const rows = [
      ['Homevault | Lista de compras', '', '', ''],
      ['Exportado em', exportedAt, '', ''],
      ['Total de itens', snapshot.summary.totalItems, 'Comprados', snapshot.summary.purchasedItems],
      ['Pendentes', snapshot.summary.pendingItems, '', ''],
      ['', '', '', ''],
      header,
      ...itemRows,
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n')}`
    downloadFile(csv, 'homevault-lista-de-compras.csv', 'text/csv;charset=utf-8')
  }

  async function exportItemsAsMarkdown() {
    const snapshot = await getShoppingExportData()
    const exportItems = snapshot.items.map(mapApiItem)
    const [header, ...rows] = getExportRows(exportItems, categories)
    const exportedAt = formatExportDate(new Date())
    const markdown = [
      '# Homevault',
      '## Lista de compras',
      '',
      `**Exportado em:** ${exportedAt}`,
      `**Resumo:** ${snapshot.summary.totalItems} itens · ${snapshot.summary.purchasedItems} comprados · ${snapshot.summary.pendingItems} pendentes`,
      '',
      '---',
      '',
      `| ${header.map(escapeMarkdownCell).join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row.map(escapeMarkdownCell).join(' | ')} |`),
    ].join('\r\n')

    downloadFile(markdown, 'homevault-lista-de-compras.md', 'text/markdown;charset=utf-8')
  }

  async function exportItemsAsPdf() {
    const [snapshot, { jsPDF }, { default: autoTable }] = await Promise.all([
      getShoppingExportData(),
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    const exportItems = snapshot.items.map(mapApiItem)
    const [header, ...itemRows] = getExportRows(exportItems, categories)
    const exportedAt = formatExportDate(new Date())
    const pdf = new jsPDF()

    pdf.setProperties({
      title: 'Homevault - Lista de compras',
      subject: 'Lista de compras',
      creator: 'Homevault',
    })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('HOMEVAULT', 14, 14)
    pdf.setFontSize(18)
    pdf.text('Lista de compras', 14, 23)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(`Exportado em: ${exportedAt}`, 14, 31)
    pdf.text(
      `Itens: ${snapshot.summary.totalItems} | Comprados: ${snapshot.summary.purchasedItems} | Pendentes: ${snapshot.summary.pendingItems}`,
      14,
      37,
    )
    autoTable(pdf, {
      startY: 44,
      head: [header.map(String)],
      body: itemRows.map((row) => row.map(String)),
      margin: { left: 14, right: 14, bottom: 16 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
      headStyles: { fontStyle: 'bold' },
      didDrawPage: (data) => {
        const pageSize = pdf.internal.pageSize
        pdf.setFontSize(8)
        pdf.text(
          `Página ${data.pageNumber}`,
          pageSize.getWidth() - 14,
          pageSize.getHeight() - 8,
          { align: 'right' },
        )
      },
    })
    pdf.save('homevault-lista-de-compras.pdf')
  }

  function adjustQuantity(amount: number) {
    setQuantity((currentQuantity) => Math.min(999, Math.max(1, currentQuantity + amount)))
  }

  function handleProductsTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touchTarget = event.target
    suppressSwipeClick.current = false
    setProductDragOffset(0)
    setIsDraggingProducts(false)

    if (touchTarget instanceof Element && touchTarget.closest('button, input, select, textarea, a')) {
      productTouchStart.current = null
      return
    }

    const touch = event.changedTouches[0]
    productTouchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function handleProductsTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const start = productTouchStart.current
    const touch = event.changedTouches[0]

    if (!start || !touch || pageCount < 2) {
      return
    }

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY) * 1.1) {
      return
    }

    const atFirstPage = currentProductPage === 0 && deltaX > 0
    const atLastPage = currentProductPage === pageCount - 1 && deltaX < 0
    const resistedOffset = deltaX * (atFirstPage || atLastPage ? 0.24 : 1)
    const maximumOffset = event.currentTarget.clientWidth * 0.85

    suppressSwipeClick.current = true
    setIsDraggingProducts(true)
    setProductDragOffset(Math.max(-maximumOffset, Math.min(maximumOffset, resistedOffset)))
  }

  function handleProductsTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const start = productTouchStart.current
    const touch = event.changedTouches[0]
    productTouchStart.current = null
    setIsDraggingProducts(false)
    setProductDragOffset(0)

    if (!start || !touch || pageCount < 2) {
      return
    }

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y

    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      window.setTimeout(() => {
        suppressSwipeClick.current = false
      }, 0)
      return
    }

    suppressSwipeClick.current = true
    window.setTimeout(() => {
      suppressSwipeClick.current = false
    }, 0)
    changeProductPage(deltaX < 0 ? 1 : -1)
  }

  function handleProductsTouchCancel() {
    productTouchStart.current = null
    suppressSwipeClick.current = false
    setIsDraggingProducts(false)
    setProductDragOffset(0)
  }

  function preventClickAfterSwipe(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressSwipeClick.current) {
      return
    }

    suppressSwipeClick.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function clearFilters() {
    setSearchQuery('')
    setCategoryFilter('all')
    resetProductPage()
  }

  return (
    <main className="homevault-page homevault-home homevault-shopping-page">
      <div className="homevault-shell">
        <header className="homevault-header homevault-home-header">
          <a className="homevault-brand" href="#/" aria-label="Voltar ao início do Homevault">
            <span className="homevault-brand-mark" aria-hidden="true">
              H
            </span>
            <span>Homevault</span>
          </a>
          <nav className="homevault-primary-nav" aria-label="Navegação principal">
            <a className="homevault-nav-link" href="#/">
              Início
            </a>
          </nav>
        </header>

        <section className="homevault-shopping-main" aria-labelledby="shopping-title">
          <div className="homevault-shopping-heading">
            <h1 className="homevault-shopping-title" id="shopping-title">
              Lista de compras
            </h1>
            <div className="homevault-shopping-summary" aria-live="polite">
              <div className="homevault-shopping-summary-leading">
                {purchasedCount > 0 && (
                  <button
                    className="homevault-shopping-clear homevault-shopping-clear-danger"
                    type="button"
                    onClick={() => setPendingRemoval({ type: 'purchased' })}
                  >
                    Limpar comprados
                  </button>
                )}
              </div>
              <div className="homevault-shopping-summary-metrics">
                <span className="homevault-shopping-count">
                  {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                </span>
                <span className="homevault-shopping-purchased-count">
                  {purchasedCount} {purchasedCount === 1 ? 'comprado' : 'comprados'}
                </span>
              </div>
              <div className="homevault-shopping-summary-trailing">
                <div className="homevault-shopping-export-dropdown" ref={exportMenuRef}>
                  <button
                    aria-controls="shopping-export-options"
                    aria-expanded={isExportMenuOpen}
                    aria-label="Exportar lista"
                    className="homevault-shopping-export-trigger"
                    disabled={totalItems === 0}
                    onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
                    title="Escolher formato de exportação"
                    type="button"
                  >
                    <Download aria-hidden="true" size={18} />
                    <span>Exportar</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`homevault-shopping-export-chevron ${isExportMenuOpen ? 'is-open' : ''}`}
                      size={16}
                    />
                  </button>
                  <div
                    aria-label="Formatos de exportação"
                    className="homevault-shopping-export-options"
                    hidden={!isExportMenuOpen}
                    id="shopping-export-options"
                    role="group"
                  >
                    <button
                      className="homevault-shopping-export-option"
                      onClick={() => void runExport(exportItems)}
                      type="button"
                    >
                      <Download aria-hidden="true" size={17} />
                      <span>CSV</span>
                    </button>
                    <button
                      className="homevault-shopping-export-option"
                      onClick={() => void runExport(exportItemsAsPdf)}
                      type="button"
                    >
                      <FileText aria-hidden="true" size={17} />
                      <span>PDF</span>
                    </button>
                    <button
                      className="homevault-shopping-export-option"
                      onClick={() => void runExport(exportItemsAsMarkdown)}
                      type="button"
                    >
                      <FileCode2 aria-hidden="true" size={17} />
                      <span>Markdown</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {categoriesError && (
            <div className="homevault-shopping-no-results" role="alert">
              <p>Não foi possível carregar as categorias: {categoriesError}</p>
              <button
                className="homevault-shopping-reset-filters"
                onClick={() => setCategoriesRetry((currentRetry) => currentRetry + 1)}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {listError && pageData && (
            <div className="homevault-shopping-no-results" role="alert">
              <p>Não foi possível atualizar a lista: {listError}</p>
              <button className="homevault-shopping-reset-filters" onClick={() => setListRetry((retry) => retry + 1)} type="button">
                Tentar novamente
              </button>
            </div>
          )}
          {actionError && (
            <div className="homevault-shopping-no-results" role="alert">
              <p>{actionError}</p>
            </div>
          )}

          <section
            className={`homevault-shopping-composer ${isComposerOpen ? '' : 'is-collapsed'}`}
            aria-labelledby="shopping-add-title"
          >
            <div className="homevault-shopping-composer-header">
              <h2 className="homevault-shopping-composer-title" id="shopping-add-title">
                Adicionar item
              </h2>
              <button
                aria-label={
                  isComposerOpen
                    ? 'Ocultar formulário de adicionar produto'
                    : 'Mostrar formulário de adicionar produto'
                }
                aria-controls="shopping-add-fields"
                aria-expanded={isComposerOpen}
                className="homevault-shopping-composer-toggle"
                onClick={() => setIsComposerOpen((isOpen) => !isOpen)}
                title={isComposerOpen ? 'Ocultar formulário' : 'Mostrar formulário'}
                type="button"
              >
                {isComposerOpen
                  ? <ChevronUp aria-hidden="true" size={20} />
                  : <ChevronDown aria-hidden="true" size={20} />}
              </button>
            </div>
            <div
              aria-hidden={!isComposerOpen}
              className={`homevault-shopping-composer-fields ${isComposerOpen ? 'is-open' : 'is-closed'}`}
              id="shopping-add-fields"
              inert={!isComposerOpen}
            >
              <div className="homevault-shopping-composer-fields-inner">
                <form className="homevault-shopping-form" onSubmit={addItem}>
                  <label className="homevault-shopping-field homevault-shopping-name-field">
                    <span>Item</span>
                    <input
                      autoComplete="off"
                      maxLength={80}
                      onChange={(event) => setItemName(event.currentTarget.value)}
                      placeholder="Ex.: leite"
                      required
                      type="text"
                      value={itemName}
                    />
                  </label>
                  <div className="homevault-shopping-field homevault-shopping-quantity-field">
                    <span id="shopping-quantity-label">Quantidade</span>
                    <div className="homevault-shopping-stepper">
                      <button
                        aria-label="Diminuir quantidade"
                        className="homevault-shopping-stepper-button"
                        disabled={quantity <= 1}
                        onClick={() => adjustQuantity(-1)}
                        title="Diminuir quantidade"
                        type="button"
                      >
                        <span aria-hidden="true">−</span>
                      </button>
                      <input
                        aria-labelledby="shopping-quantity-label"
                        max={999}
                        min={1}
                        onChange={(event) => setQuantity(Number(event.currentTarget.value))}
                        required
                        type="number"
                        value={quantity}
                      />
                      <button
                        aria-label="Aumentar quantidade"
                        className="homevault-shopping-stepper-button"
                        disabled={quantity >= 999}
                        onClick={() => adjustQuantity(1)}
                        title="Aumentar quantidade"
                        type="button"
                      >
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>
                  </div>
                  <label className="homevault-shopping-field homevault-shopping-category-field">
                    <span>Categoria</span>
                    <span className="homevault-shopping-select">
                      <select
                        disabled={isLoadingCategories || categories.length === 0}
                        onChange={(event) => setCategoryId(event.currentTarget.value)}
                        value={categoryId}
                      >
                        {categories.map((shoppingCategory) => (
                          <option key={shoppingCategory.id} value={shoppingCategory.id}>
                            {shoppingCategory.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" size={18} />
                    </span>
                  </label>
                  <button className="homevault-shopping-add" disabled={!categoryId || isSubmittingItem} type="submit">
                    <span aria-hidden="true">+</span>
                    <span>{isSubmittingItem ? 'Adicionando...' : 'Adicionar item'}</span>
                  </button>
                </form>
              </div>
            </div>
          </section>

          {listError && !pageData ? (
            <div className="homevault-shopping-empty" role="alert">
              <div>
                <strong>A lista está indisponível</strong>
                <p>{listError}</p>
                <button className="homevault-shopping-reset-filters" onClick={() => setListRetry((retry) => retry + 1)} type="button">
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : isLoadingList && !pageData ? (
            <div className="homevault-shopping-empty" role="status">
              <p>Carregando lista de compras...</p>
            </div>
          ) : totalItems === 0 ? (
            <div className="homevault-shopping-empty" role="status">
              <span className="homevault-shopping-empty-mark" aria-hidden="true">+</span>
              <div>
                <strong>Sua lista está vazia</strong>
                <p>Adicione o que está faltando em casa.</p>
              </div>
            </div>
          ) : (
            <>
              <section className="homevault-shopping-filter-panel" aria-label="Filtros da lista">
                <div className="homevault-shopping-filter-heading">
                  <h2>Filtrar itens</h2>
                  <div className="homevault-shopping-filter-actions">
                    <span className="homevault-shopping-results-count" role="status" aria-live="polite">
                      {totalMatchingItems} {totalMatchingItems === 1 ? 'resultado' : 'resultados'}
                    </span>
                    {hasActiveFilters && (
                      <button
                        className="homevault-shopping-reset-filters"
                        onClick={clearFilters}
                        type="button"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                </div>
                <div className="homevault-shopping-filters" role="search" aria-label="Filtrar lista de compras">
                  <label className="homevault-shopping-field homevault-shopping-search-field">
                    <span>Buscar por nome</span>
                    <span className="homevault-shopping-search-input">
                      <Search aria-hidden="true" size={18} />
                      <input
                        autoComplete="off"
                        onChange={(event) => {
                          setSearchQuery(event.currentTarget.value)
                          resetProductPage()
                        }}
                        placeholder="Buscar na lista"
                        type="search"
                        value={searchQuery}
                      />
                    </span>
                  </label>
                  <label className="homevault-shopping-field homevault-shopping-filter-category-field">
                    <span>Filtrar por categoria</span>
                    <span className="homevault-shopping-select">
                      <select
                        onChange={(event) => {
                          setCategoryFilter(event.currentTarget.value)
                          resetProductPage()
                        }}
                        value={categoryFilter}
                      >
                        <option value="all">Todas as categorias</option>
                        {categories.map((shoppingCategory) => (
                          <option key={shoppingCategory.id} value={shoppingCategory.id}>
                            {shoppingCategory.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" size={18} />
                    </span>
                  </label>
                </div>
              </section>
              {pageCount > 1 && (
                <div className="homevault-shopping-carousel-controls" role="group" aria-label="Navegação dos produtos">
                  <span className="homevault-shopping-carousel-range">
                    {firstProductIndex + 1}–{Math.min(firstProductIndex + shoppingItemsPerPage, totalMatchingItems)} de {totalMatchingItems}
                  </span>
                  <div className="homevault-shopping-carousel-pages">
                    <button
                      aria-label="Página anterior de produtos"
                      className="homevault-shopping-carousel-button"
                      disabled={currentProductPage === 0}
                      onClick={() => changeProductPage(-1)}
                      title="Página anterior"
                      type="button"
                    >
                      <ChevronLeft aria-hidden="true" size={20} />
                    </button>
                    <span aria-live="polite">
                      Página {currentProductPage + 1} de {pageCount}
                    </span>
                    <button
                      aria-label="Próxima página de produtos"
                      className="homevault-shopping-carousel-button"
                      disabled={currentProductPage >= pageCount - 1}
                      onClick={() => changeProductPage(1)}
                      title="Próxima página"
                      type="button"
                    >
                      <ChevronRight aria-hidden="true" size={20} />
                    </button>
                  </div>
                </div>
              )}
              {totalMatchingItems === 0 ? (
                <div className="homevault-shopping-no-results" role="status">
                  <p>Nenhum item corresponde à busca e à categoria. Ajuste os filtros acima.</p>
                </div>
              ) : (
                <div className="homevault-shopping-carousel-viewport">
                  <div
                    className={`homevault-shopping-carousel-track ${isDraggingProducts ? 'is-dragging' : ''} ${isTrackResetting ? 'is-resetting' : ''}`}
                    onClickCapture={preventClickAfterSwipe}
                    onTouchCancel={handleProductsTouchCancel}
                    onTouchEnd={handleProductsTouchEnd}
                    onTouchMove={handleProductsTouchMove}
                    onTouchStart={handleProductsTouchStart}
                    onTransitionEnd={(event) => {
                      if (event.propertyName !== 'transform' || !pageTransition || pageTransition.phase !== 'moving') return
                      const transitionId = pageTransition.id
                      setIsTrackResetting(true)
                      window.requestAnimationFrame(() => {
                        setPageTransition((current) => current?.id === transitionId ? null : current)
                        window.requestAnimationFrame(() => setIsTrackResetting(false))
                      })
                    }}
                    style={{ transform: trackTransform }}
                  >
                    {renderedProductPages.map((pageItems, pageIndex) => (
                      <ul
                        aria-hidden={pageIndex !== activeRenderedPageIndex}
                        aria-label={`Produtos da página ${pageTransition
                          ? currentProductPage + (pageTransition.direction === -1 ? pageIndex + 1 : pageIndex)
                          : currentProductPage + 1} de ${pageCount}`}
                        className="homevault-shopping-list"
                        inert={pageIndex !== activeRenderedPageIndex}
                        key={pageTransition ? `${pageTransition.id}-${pageIndex}` : `page-${currentProductPage}`}
                      >
                        {pageItems.map((item) => (
                          <li
                            className={`homevault-shopping-item ${item.purchased ? 'is-purchased' : ''} ${item.id === newlyAddedItemId ? 'is-new' : ''}`}
                            key={item.id}
                            onAnimationEnd={() => {
                              setNewlyAddedItemId((currentId) => currentId === item.id ? null : currentId)
                            }}
                          >
                            <label className="homevault-shopping-item-toggle">
                              <input
                                aria-label={`Marcar ${item.name} como comprado`}
                                checked={item.purchased}
                                disabled={updatingItemId === item.id}
                                onChange={() => togglePurchased(item)}
                                type="checkbox"
                              />
                              <span className="homevault-shopping-item-copy">
                                <strong>{item.name}</strong>
                                <small className="homevault-shopping-category">{item.category}</small>
                              </span>
                            </label>
                            <span className="homevault-shopping-quantity">
                              {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'}
                            </span>
                            <button
                              aria-label={`Excluir ${item.name}`}
                              className="homevault-shopping-remove"
                              onClick={() => setPendingRemoval({ type: 'item', item })}
                              title={`Excluir ${item.name}`}
                              type="button"
                            >
                              <Trash2 aria-hidden="true" size={18} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        <dialog
          aria-describedby="shopping-delete-description"
          aria-labelledby="shopping-delete-title"
          className="homevault-shopping-delete-dialog"
          onCancel={(event) => {
            event.preventDefault()
            setPendingRemoval(null)
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingRemoval(null)
            }
          }}
          ref={deleteDialogRef}
        >
          {pendingRemoval && (
            <div className="homevault-shopping-delete-content">
              <div className="homevault-shopping-delete-header">
                <span className="homevault-shopping-delete-icon" aria-hidden="true">
                  <Trash2 size={22} />
                </span>
                <h2 id="shopping-delete-title">
                  {pendingRemoval.type === 'item' ? 'Excluir produto?' : 'Limpar comprados?'}
                </h2>
              </div>
              <p id="shopping-delete-description">
                {pendingRemoval.type === 'item' ? (
                  <>
                    Tem certeza de que deseja excluir <strong>{pendingRemoval.item.name}</strong> da lista?
                    {' '}Esta ação não pode ser desfeita.
                  </>
                ) : (
                  <>
                    Tem certeza de que deseja remover <strong>{purchasedCount} {purchasedCount === 1 ? 'produto comprado' : 'produtos comprados'}</strong> da lista?
                    {' '}Esta ação não pode ser desfeita.
                  </>
                )}
              </p>
              <div className="homevault-shopping-delete-actions">
                <button
                  className="homevault-shopping-delete-confirm"
                  disabled={isClearingPurchased}
                  onClick={confirmPendingRemoval}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={17} />
                  <span>{pendingRemoval.type === 'item' ? 'Excluir' : 'Limpar'}</span>
                </button>
                <button
                  autoFocus
                  className="homevault-shopping-delete-cancel"
                  onClick={() => setPendingRemoval(null)}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </dialog>
      </div>
    </main>
  )
}

export default ShoppingListPage