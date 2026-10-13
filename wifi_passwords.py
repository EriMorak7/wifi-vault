"""Saved Wi-Fi Password Viewer (Windows).
Shows Wi-Fi networks saved on THIS PC and their passwords.
Run: python wifi_passwords.py
"""
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox

FLAGS = subprocess.CREATE_NO_WINDOW  # hide console flash


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", errors="ignore",
                          creationflags=FLAGS).stdout


def get_profiles():
    out = run(["netsh", "wlan", "show", "profiles"])
    names = []
    for line in out.splitlines():
        if "All User Profile" in line and ":" in line:
            names.append(line.split(":", 1)[1].strip())
    return names


def get_password(name):
    out = run(["netsh", "wlan", "show", "profile", f"name={name}", "key=clear"])
    for line in out.splitlines():
        if "Key Content" in line and ":" in line:
            return line.split(":", 1)[1].strip()
    return "(none / open network)"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Saved Wi-Fi Passwords")
        self.geometry("520x380")

        self.tree = ttk.Treeview(self, columns=("ssid", "pw"), show="headings")
        self.tree.heading("ssid", text="Network")
        self.tree.heading("pw", text="Password")
        self.tree.column("ssid", width=220)
        self.tree.column("pw", width=260)
        self.tree.pack(fill="both", expand=True, padx=10, pady=(10, 5))

        bar = ttk.Frame(self)
        bar.pack(fill="x", padx=10, pady=(0, 10))
        ttk.Button(bar, text="Refresh", command=self.load).pack(side="left")
        ttk.Button(bar, text="Copy password", command=self.copy).pack(side="left", padx=6)

        self.load()

    def load(self):
        self.tree.delete(*self.tree.get_children())
        profiles = get_profiles()
        if not profiles:
            messagebox.showinfo("No networks", "No saved Wi-Fi profiles found.")
        for name in profiles:
            self.tree.insert("", "end", values=(name, get_password(name)))

    def copy(self):
        sel = self.tree.selection()
        if not sel:
            return
        pw = self.tree.item(sel[0], "values")[1]
        self.clipboard_clear()
        self.clipboard_append(pw)


if __name__ == "__main__":
    App().mainloop()
