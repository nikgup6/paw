from playwright.sync_api import sync_playwright

def test_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        page.on("console", lambda msg: print(f"Browser console [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser error: {err}"))
        
        print("Navigating to home...")
        page.goto("http://localhost:5174/")
        page.wait_for_selector(".hero-cta", timeout=5000)
        
        print("Clicking Find My Breed...")
        page.click(".hero-cta")
        page.wait_for_selector(".option-btn", timeout=5000)
        
        print("Clicking through quiz...")
        for i in range(10):
            try:
                page.click(".option-btn", timeout=2000)
                page.click(".btn-next", timeout=2000)
            except Exception as e:
                print(f"Error at question {i}: {e}")
                break
                
        print("Waiting for results page...")
        try:
            page.wait_for_selector(".top-match", timeout=10000)
            print("Results loaded successfully!")
        except Exception as e:
            print("Timeout waiting for results page:", e)
            
        browser.close()

if __name__ == "__main__":
    test_flow()
