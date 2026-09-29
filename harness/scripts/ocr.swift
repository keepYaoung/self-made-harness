// macOS Vision OCR + 정확 일치 픽셀 카운트. verify.mjs 가 컴파일해 부른다.
// 사용: ocr <hex,hex,...> <png> [<png> ...]
// 출력: 파일마다 JSON 한 줄 { file, width, height, lines:[{text,x,y,w,h}], colorHits:{hex:count} }
// 좌표는 0–1 정규화, y 는 위에서부터.
import Foundation
import Vision
import CoreGraphics
import ImageIO

func hexKey(_ r: UInt8, _ g: UInt8, _ b: UInt8) -> String {
  String(format: "#%02X%02X%02X", r, g, b)
}

let args = CommandLine.arguments
guard args.count >= 3 else {
  FileHandle.standardError.write("usage: ocr <hex,hex> <png>...\n".data(using: .utf8)!)
  exit(2)
}
let targets = Set(args[1].split(separator: ",").map { $0.uppercased() }.filter { !$0.isEmpty })

for path in args.dropFirst(2) {
  let url = URL(fileURLWithPath: path)
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
    FileHandle.standardError.write("cannot read \(path)\n".data(using: .utf8)!)
    exit(2)
  }
  let w = img.width, h = img.height

  // 픽셀: RGBA8 로 다시 그려서 센다 (색 공간 변환 없이 sRGB)
  var hits: [String: Int] = [:]
  if !targets.isEmpty {
    let cs = CGColorSpace(name: CGColorSpace.sRGB)!
    var buf = [UInt8](repeating: 0, count: w * h * 4)
    let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                        space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    for t in targets { hits[t] = 0 }
    var i = 0
    while i < buf.count {
      if buf[i + 3] == 255 {
        let k = hexKey(buf[i], buf[i + 1], buf[i + 2])
        if hits[k] != nil { hits[k]! += 1 }
      }
      i += 4
    }
  }

  // OCR — 언어 우선순위가 앞선 문자만 잘 읽혀서, CJK 언어마다 한 번씩 돌린다.
  // 각 줄에 pass(주 언어)를 붙인다. en 줄은 모든 pass 에서 비슷하게 나오므로 중복 제거.
  var lines: [[String: Any]] = []
  var seen = Set<String>()
  let passes: [(String, [String])] = [("ko", ["ko-KR", "en-US"]), ("ja", ["ja-JP", "en-US"]), ("zh", ["zh-Hans", "en-US"])]
  let handler = VNImageRequestHandler(cgImage: img, options: [:])
  for (tag, langs) in passes {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    req.minimumTextHeight = 0.004   // 목업 속 작은 버튼 글자까지 (이미지 높이 대비)
    req.recognitionLanguages = langs
    do { try handler.perform([req]) } catch {
      FileHandle.standardError.write("ocr failed \(path): \(error)\n".data(using: .utf8)!)
      exit(2)
    }
    for obs in req.results ?? [] {
      guard let top = obs.topCandidates(1).first else { continue }
      if seen.contains(top.string) { continue }
      seen.insert(top.string)
      let b = obs.boundingBox
      lines.append(["text": top.string, "pass": tag, "x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height])
    }
  }

  let out: [String: Any] = ["file": path, "width": w, "height": h, "lines": lines, "colorHits": hits]
  let data = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
  print(String(data: data, encoding: .utf8)!)
}
