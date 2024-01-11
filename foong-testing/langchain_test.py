import os
from dotenv import load_dotenv
from langchain_community.utilities import SQLDatabase
from langchain_experimental.sql import SQLDatabaseChain
from langchain_openai import OpenAI

# db = SQLDatabase.from_uri("sqlite:///Chinook.db")
# llm = OpenAI(temperature=0, verbose=True)
# db_chain = SQLDatabaseChain.from_llm(llm, db, verbose=True)

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
print(OPENAI_API_KEY)
