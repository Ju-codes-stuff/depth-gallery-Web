class Label {
  constructor(gallery) {
    this.gallery = gallery

    this.overlayElement = null
    this.tagElement = null
    this.periodElement = null
    this.titleElement = null
    this.bodyElement = null
    this.activePlaneIndex = -1
  }

  createElement() {
    const element = document.createElement('section')
    element.className = 'timeline-label'
    element.innerHTML = `
      <span class="timeline-label__tag"></span>
      <p    class="timeline-label__period"></p>
      <h2   class="timeline-label__title"></h2>
      <p    class="timeline-label__body"></p>
    `

    return {
      element,
      tagElement:    element.querySelector('.timeline-label__tag'),
      periodElement: element.querySelector('.timeline-label__period'),
      titleElement:  element.querySelector('.timeline-label__title'),
      bodyElement:   element.querySelector('.timeline-label__body'),
    }
  }

  init() {
    if (this.overlayElement) return

    const { element, tagElement, periodElement, titleElement, bodyElement } =
      this.createElement()

    this.overlayElement = element
    this.tagElement     = tagElement
    this.periodElement  = periodElement
    this.titleElement   = titleElement
    this.bodyElement    = bodyElement

    this.overlayElement.style.opacity = '0'
    document.body.append(this.overlayElement)
  }

  getTargetPlaneIndex(cameraZ) {
    const blendData = this.gallery.getPlaneBlendData(cameraZ)
    if (!blendData) return -1
    return blendData.blend >= 0.5 ? blendData.nextPlaneIndex : blendData.currentPlaneIndex
  }

  applyPlaneContent(planeIndex) {
    const plane = this.gallery.planes[planeIndex]
    if (!plane || this.activePlaneIndex === planeIndex) return

    const t = plane.userData.label || {}

    this.tagElement.textContent    = t.tag    || ''
    this.periodElement.textContent = t.period || ''
    this.titleElement.textContent  = t.title  || ''
    this.bodyElement.textContent   = t.body   || ''

    this.tagElement.style.color    = t.accent    || ''
    this.periodElement.style.color = t.accent    || ''
    this.titleElement.style.color  = t.textColor || ''
    this.bodyElement.style.color   = t.textColor || ''

    this.activePlaneIndex = planeIndex
  }

  resize() {}

  update(camera = null) {
    if (!camera || !this.overlayElement) return

    const targetPlaneIndex = this.getTargetPlaneIndex(camera.position.z)
    if (targetPlaneIndex < 0) {
      this.overlayElement.style.opacity = '0'
      return
    }

    this.applyPlaneContent(targetPlaneIndex)
    this.overlayElement.style.opacity = '1'
  }

  render() {}

  dispose() {
    this.overlayElement?.remove()
    this.overlayElement = null
    this.tagElement     = null
    this.periodElement  = null
    this.titleElement   = null
    this.bodyElement    = null
    this.activePlaneIndex = -1
  }
}

export { Label }