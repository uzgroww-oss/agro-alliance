import pathlib, re
fp = pathlib.Path('D:/allianse/src/pages/dashboard/BloggerDashboard.tsx')
content = fp.read_text('utf-8')

# Replace VideosCard function's add function
old = '''  const add = async () => {
  const [linkError, setLinkError] = useState("")
    if (!link.trim()) return
    setBusy(true)
    try { await api("/me/videos", { method: "POST", body: JSON.stringify({ link }) }); setLink(""); setAdding(false); reload() }
    finally { setBusy(false) }
  }'''

new = '''  const [linkError, setLinkError] = useState("")
  const add = async () => {
    setLinkError("")
    if (!link.trim()) { setLinkError("Link kiriting"); return }
    if (!link.trim().match(/^(https?:\\/\\/)?(www\\.)?[-a-zA-Z0-9@:%.+~#=]{1,256}\\.[a-zA-Z]{2,}/)) {
      setLinkError("Yaroqli URL formatida emas")
      return
    }
    setBusy(true)
    try {
      await api("/me/videos", { method: "POST", body: JSON.stringify({ link: link.trim() }) })
      setLink(""); setAdding(false); setLinkError(""); reload()
    } catch (err):
      setLinkError(err instanceof Error ? err.message : "Xatolik yuz berdi")
    }
    finally { setBusy(false) }
  }'''

count = content.count(old)
print(f"Found old text {count} times")

if count > 0:
    content = content.replace(old, new)
    fp.write_text(content, 'utf-8')
    print("Fixed!")
else:
    # Find what's actually around that area
    idx = content.find('const add = async')
    print(f"Found 'const add' at index {idx}")
    if idx >= 0:
        print(repr(content[idx:idx+300]))
