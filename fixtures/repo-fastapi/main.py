from fastapi import FastAPI

app = FastAPI(title="Sample API")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/items/{item_id}")
def read_item(item_id: int):
    return {"item_id": item_id}
