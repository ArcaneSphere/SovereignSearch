// tela-server.go — Multiplexed SCID + Folder Auto-Detection (2025)
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/civilware/tela"
)

var (
	mu       sync.RWMutex
	proxies  = make(map[string]*httputil.ReverseProxy) // scid → proxy
	baseURLs = make(map[string]string)                // scid → base URL
)

func main() {
	port := flag.Int("port", 4040, "Main proxy port")
	scidRoot := flag.String("scid-root", "scids", "Local SCID folders root")
	flag.Parse()

	tela.AllowUpdates(true)

	// Serve local SCID folders via /scidfiles/<SCID>/
	http.Handle("/scidfiles/", http.StripPrefix("/scidfiles/", http.FileServer(http.Dir(*scidRoot))))

	// Add/register SCID
http.HandleFunc("/add/", func(w http.ResponseWriter, r *http.Request) {
    scid := strings.TrimPrefix(r.URL.Path, "/add/")
    scid = strings.Split(scid, "/")[0]
    node := r.URL.Query().Get("node")
    if node == "" {
        node = "127.0.0.1:10102"
    }

    // ✅ OPTION A: idempotent guard
    mu.RLock()
    _, alreadyLoaded := proxies[scid]
    mu.RUnlock()

   if alreadyLoaded {
    mu.RLock()
    base := baseURLs[scid]
    mu.RUnlock()

    log.Printf("SCID %s already registered — returning existing URL", scid[:8])
    fmt.Fprintf(w, "OK: %s", base)
    return
}

    var rawURL string
    folderPath := filepath.Join(*scidRoot, scid)

    if _, err := os.Stat(folderPath); err == nil {
        rawURL = fmt.Sprintf(
            "http://127.0.0.1:%d/scidfiles/%s/index.html",
            *port,
            scid,
        )
        log.Printf("SCID %s: serving local folder", scid[:8])
    } else {
        url, err := tela.ServeTELA(scid, node)
        if err != nil {
            http.Error(w, "Tela failed: "+err.Error(), 500)
            return
        }
        rawURL = url
        log.Printf("SCID %s: started dynamic Tela server", scid[:8])
    }

    base := strings.TrimSuffix(rawURL, "/index.html")
    if !strings.HasSuffix(base, "/") {
        base += "/"
    }

    target, _ := url.Parse(base)
    proxy := httputil.NewSingleHostReverseProxy(target)
    proxy.ModifyResponse = func(r *http.Response) error {
        r.Header.Del("Content-Security-Policy")
        return nil
    }

    mu.Lock()
    proxies[scid] = proxy
    baseURLs[scid] = base
    mu.Unlock()

    fmt.Fprintf(w, "OK: %s", rawURL)
})


	// Main multiplexed proxy: /tela/<SCID>/*
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/"), "/", 2)
		if len(parts) < 2 || parts[0] != "tela" {
			http.NotFound(w, r)
			return
		}
		scid := strings.Split(parts[1], "/")[0]

		mu.RLock()
		proxy, exists := proxies[scid]
		base := baseURLs[scid]
		mu.RUnlock()

		if !exists {
			http.Error(w, "SCID not loaded. Visit /add/<SCID>?node=... first", 404)
			return
		}

		// Rewrite path to proxy base
		if len(parts) == 2 {
			r.URL.Path = "/" + strings.TrimPrefix(parts[1], scid)
		} else {
			r.URL.Path = "/"
		}

		target, _ := url.Parse(base)
		r.Host = target.Host
		r.URL.Host = target.Host
		r.URL.Scheme = target.Scheme

		log.Printf("[DEBUG] Proxying SCID %s path: %s → %s", scid[:8], r.URL.Path, base)
		proxy.ServeHTTP(w, r)
	})

	log.Printf("Multiplexed SCID proxy listening on :%d", *port)
	log.Printf("Add SCID with: http://127.0.0.1:%d/add/<SCID>?node=<NODE>", *port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf("127.0.0.1:%d", *port), nil))
}

