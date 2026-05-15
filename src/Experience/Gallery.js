import * as THREE from 'three'
import { galleryPlaneData } from '@/data/galleryData'

class Gallery {
  constructor(debug = null) {
    this.isInitialized = false
    this.isDebugBound = false
    this.debug = debug

    // Planes
    this.planes = []
    
    this.planeGap = 5
    this.desktopPlaneScale = 1
    this.mobilePlaneScale = 0.65
    this.mobileXSpreadFactor = 0.25
    this.mobileBreakpoint = 768
    this.planeConfig = galleryPlaneData
    this.moodSampleOffset = 1
    this.planeFadeSampleOffset = 1
    this.planeFadeSmoothing = 0.14

    // Parallax
    this.parallaxEnabled = true
    this.parallaxAmountX = 0.16
    this.parallaxAmountY = 0.08
    this.parallaxSmoothing = 0.08
    this.pointerTarget = new THREE.Vector2(0, 0)
    this.pointerCurrent = new THREE.Vector2(0, 0)

    // Breath
    this.breathEnabled = true
    this.breathTiltAmount = 0.045
    this.breathScaleAmount = 0.03
    this.breathSmoothing = 0.14
    this.breathGain = 1.1
    this.breathIntensity = 0
    this.targetBreathIntensity = 0

    // Gesture drift
    this.gestureParallaxEnabled = true
    this.gestureParallaxAmountY = 0.05
    this.gestureParallaxSmoothing = 0.05
    this.driftCurrent = 0
    this.driftTarget = 0

    // Pointer events
    this.onPointerMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = (event.clientY / window.innerHeight) * 2 - 1
      this.pointerTarget.set(x, -y)
    }
    this.onPointerLeave = () => {
      this.pointerTarget.set(0, 0)
    }
  }

  async init(scene) {
    if (this.isInitialized) return

    this.setPlanes(scene)
    this.updatePlaneScale()
    this.layoutPlanes()
    this.bindPointerEvents()
    this.bindDebug()

    this.isInitialized = true
  }

  getTextureSources() {
  return []
  }

  setPreloadedTextures(textures) {
  // no-op — timeline mode uses no textures
  }

  setPlanes(scene) {
  this.planeConfig.forEach((plane, index) => {
    const geometry = new THREE.PlaneGeometry(2.2, 3.0) // fixed size, no aspect ratio needed

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: index === 0 ? 0 : 0, // all invisible — text overlay IS the content
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geometry, material)

    mesh.userData.basePosition    = plane.position
    mesh.userData.backgroundColor = plane.mood.background  // ← new field path
    mesh.userData.blob1Color      = plane.mood.blob1       // ← new field path
    mesh.userData.blob2Color      = plane.mood.blob2       // ← new field path
    mesh.userData.label           = plane.timeline         // ← pass through whole timeline object

    scene.add(mesh)
    this.planes.push(mesh)
    })
  }

  

  updatePlaneScale() {
    const isMobileViewport = window.innerWidth <= this.mobileBreakpoint
    const scale = isMobileViewport ? this.mobilePlaneScale : this.desktopPlaneScale

    this.planes.forEach((plane) => {
      plane.scale.set(scale, scale, 1)
    })
  }

  layoutPlanes() {
    const xSpreadFactor = this.getXSpreadFactor()

    this.planes.forEach((plane, index) => {
      const basePosition = plane.userData.basePosition || { x: 0, y: 0 }
      const xPosition = basePosition.x * xSpreadFactor
      plane.position.set(xPosition, basePosition.y, -index * this.planeGap)
    })
  }

  getXSpreadFactor() {
    const isMobileViewport = window.innerWidth <= this.mobileBreakpoint
    return isMobileViewport ? this.mobileXSpreadFactor : 1
  }

  getDepthRange() {
    if (!this.planes.length) {
      return { nearestZ: 0, deepestZ: 0 }
    }

    const zPositions = this.planes.map((plane) => plane.position.z)
    return {
      nearestZ: Math.max(...zPositions),
      deepestZ: Math.min(...zPositions),
    }
  }

  getDepthProgress(cameraZ) {
    const { nearestZ, deepestZ } = this.getDepthRange()
    const depthSpan = nearestZ - deepestZ
    if (depthSpan <= 0) return 0

    return THREE.MathUtils.clamp((nearestZ - cameraZ) / depthSpan, 0, 1)
  }

  getActivePlaneIndex(cameraZ) {
    if (!this.planes.length) return -1

    let closestPlaneIndex = 0
    let smallestDistance = Infinity

    this.planes.forEach((plane, index) => {
      const distanceToPlane = Math.abs(cameraZ - plane.position.z)
      if (distanceToPlane < smallestDistance) {
        smallestDistance = distanceToPlane
        closestPlaneIndex = index
      }
    })

    return closestPlaneIndex
  }

  getMoodColorsByIndex(index) {
    if (index < 0 || index >= this.planes.length) return null

    const { backgroundColor, blob1Color, blob2Color } = this.planes[index].userData
    if (!backgroundColor) return null

    return { background: backgroundColor, blob1: blob1Color, blob2: blob2Color }
  }

  getMoodBlendData(cameraZ) {
    if (!this.planes.length) return null

    const safeCameraZ = Number.isFinite(cameraZ) ? cameraZ : this.planes[0].position.z
    const moodSampleZ = safeCameraZ - this.planeGap * this.moodSampleOffset
    const lastPlaneIndex = this.planes.length - 1

    if (lastPlaneIndex === 0 || this.planeGap <= 0) {
      const singleMood = this.getMoodColorsByIndex(0)
      if (!singleMood) return null

      return {
        currentMood: singleMood,
        nextMood: singleMood,
        blend: 0,
      }
    }

    const firstPlaneZ = this.planes[0].position.z
    const normalizedDepth = THREE.MathUtils.clamp(
      (firstPlaneZ - moodSampleZ) / this.planeGap,
      0,
      lastPlaneIndex
    )
    const currentPlaneIndex = Math.floor(normalizedDepth)
    const nextPlaneIndex = Math.min(currentPlaneIndex + 1, lastPlaneIndex)
    const blend = normalizedDepth - currentPlaneIndex

    const currentMood = this.getMoodColorsByIndex(currentPlaneIndex)
    const nextMood = this.getMoodColorsByIndex(nextPlaneIndex) || currentMood
    if (!currentMood || !nextMood) return null

    return {
      currentMood,
      nextMood,
      blend,
    }
  }

  getPlaneBlendData(cameraZ) {
    if (!this.planes.length) return null

    const planeGap = Math.max(this.planeGap, 0.0001)
    const firstPlaneZ = this.planes[0].position.z
    const lastPlaneIndex = this.planes.length - 1
    const sampledCameraZ = cameraZ - planeGap * this.planeFadeSampleOffset
    const normalizedDepth = THREE.MathUtils.clamp(
      (firstPlaneZ - sampledCameraZ) / planeGap,
      0,
      lastPlaneIndex
    )
    const currentPlaneIndex = Math.floor(normalizedDepth)
    const nextPlaneIndex = Math.min(currentPlaneIndex + 1, lastPlaneIndex)
    const blend = normalizedDepth - currentPlaneIndex

    return {
      currentPlaneIndex,
      nextPlaneIndex,
      blend,
    }
  }

  getActiveMoodColors(cameraZ) {
    const moodBlendData = this.getMoodBlendData(cameraZ)
    return moodBlendData?.currentMood || null
  }


  

  

  bindDebug() {
    if (!this.debug || this.isDebugBound) return

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'planeGap',
      label: 'Gap',
      options: {
        min: 0.4,
        max: 10,
        step: 0.1,
      },
      onChange: () => {
        this.layoutPlanes()
      },
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'moodSampleOffset',
      label: 'Mood Offset',
      options: {
        min: 0,
        max: 1.5,
        step: 0.01,
      },
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'parallaxEnabled',
      label: 'Plane Parallax',
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'parallaxAmountX',
      label: 'Parallax X',
      options: {
        min: 0,
        max: 0.5,
        step: 0.01,
      },
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'parallaxAmountY',
      label: 'Parallax Y',
      options: {
        min: 0,
        max: 0.3,
        step: 0.01,
      },
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'gestureParallaxEnabled',
      label: 'Gesture Parallax',
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'gestureParallaxAmountY',
      label: 'Gesture Y',
      options: {
        min: 0,
        max: 0.5,
        step: 0.01,
      },
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'breathEnabled',
      label: 'Plane Breath',
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'breathTiltAmount',
      label: 'Breath Tilt',
      options: {
        min: 0,
        max: 0.2,
        step: 0.005,
      },
    })

    this.debug.addBinding({
      folderTitle: 'Gallery',
      targetObject: this,
      property: 'breathScaleAmount',
      label: 'Breath Scale',
      options: {
        min: 0,
        max: 0.1,
        step: 0.001,
      },
    })

    this.isDebugBound = true
  }

  updatePlaneVisibility(cameraZ) {
    const blendData = this.getPlaneBlendData(cameraZ)
    if (!blendData) return

    const { currentPlaneIndex, nextPlaneIndex, blend } = blendData

    this.planes.forEach((plane, index) => {
      let targetOpacity = 0

      if (index === currentPlaneIndex) {
        targetOpacity = 1 - blend
      }
      if (index === nextPlaneIndex) {
        targetOpacity = Math.max(targetOpacity, blend)
      }

      const currentOpacity = Number.isFinite(plane.material.opacity) ? plane.material.opacity : 0
      plane.material.opacity = THREE.MathUtils.lerp(
        currentOpacity,
        targetOpacity,
        this.planeFadeSmoothing
      )
      plane.material.needsUpdate = true
    })
  }

  bindPointerEvents() {
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
  }

  updatePlaneMotion(scroll = null) {
    // Smooth pointer toward target
    this.pointerCurrent.lerp(this.pointerTarget, this.parallaxSmoothing)

    // Velocity → breath + drift
    const velocityMax = Math.max(scroll?.velocityMax || 1, 0.0001)
    const velocityNormalized = THREE.MathUtils.clamp(
      Math.abs(scroll?.velocity || 0) / velocityMax,
      0,
      1
    )
    const scrollDrift = THREE.MathUtils.clamp((scroll?.velocity || 0) / velocityMax, -1, 1)
    this.targetBreathIntensity = this.breathEnabled
      ? THREE.MathUtils.clamp(velocityNormalized * this.breathGain, 0, 1)
      : 0
    this.breathIntensity = THREE.MathUtils.lerp(
      this.breathIntensity,
      this.targetBreathIntensity,
      this.breathSmoothing
    )
    this.driftTarget = this.gestureParallaxEnabled ? scrollDrift : 0
    this.driftCurrent = THREE.MathUtils.lerp(
      this.driftCurrent,
      this.driftTarget,
      this.gestureParallaxSmoothing
    )

    // Per-plane: position, rotation, scale
    const xSpreadFactor = this.getXSpreadFactor()

    this.planes.forEach((plane, index) => {
      const basePosition = plane.userData.basePosition || { x: 0, y: 0 }
      const xPosition = basePosition.x * xSpreadFactor
      const yPosition = basePosition.y
      const zPosition = -index * this.planeGap
      const opacity = Number.isFinite(plane.material.opacity) ? plane.material.opacity : 0
      const depthInfluence = 1 + index * 0.05
      const parallaxInfluence = this.parallaxEnabled ? opacity * depthInfluence : 0

      const parallaxOffsetX = this.pointerCurrent.x * this.parallaxAmountX * parallaxInfluence
      const parallaxOffsetY = this.pointerCurrent.y * this.parallaxAmountY * parallaxInfluence
      const gestureOffsetY = this.driftCurrent * this.gestureParallaxAmountY

      plane.position.x = xPosition + parallaxOffsetX
      plane.position.y = yPosition + parallaxOffsetY + gestureOffsetY
      plane.position.z = zPosition

      const breathInfluence = this.breathEnabled ? this.breathIntensity * opacity : 0
      const tiltX = -this.pointerCurrent.y * this.breathTiltAmount * breathInfluence
      const tiltY = this.pointerCurrent.x * this.breathTiltAmount * breathInfluence
      plane.rotation.x = tiltX
      plane.rotation.y = tiltY
      plane.rotation.z = 0

      const baseScale =
        window.innerWidth <= this.mobileBreakpoint ? this.mobilePlaneScale : this.desktopPlaneScale
      const scalePulse = 1 + this.breathScaleAmount * breathInfluence
      plane.scale.x = baseScale * scalePulse
      plane.scale.y = baseScale * scalePulse
      plane.scale.z = 1
    })
  }

  update(camera = null, scroll = null) {
    if (!camera) return
    this.updatePlaneVisibility(camera.position.z)
    this.updatePlaneMotion(scroll)
  }

  dispose() {
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerleave', this.onPointerLeave)
  }
}

export { Gallery }
