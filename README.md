# 🐍 Python Learning & Data Analysis Repository

Welcome to my Python learning repository!

This repository contains my hands-on practice with **Python programming, NumPy, Pandas, and Matplotlib**. It documents my progress while learning Python fundamentals and exploring commonly used libraries for **data analysis and numerical computing**.

The repository includes practice programs, assignments, array operations, randomly generated datasets, and statistical calculations.

---

## 📌 Repository Overview

| Notebook                    | Description                                       | Status        |
| --------------------------- | ------------------------------------------------- | ------------- |
| `bootcamp_assignment.ipynb` | Python fundamentals and programming exercises     | ✅ In Progress |
| `numPy.ipynb`               | NumPy arrays, datasets and statistical operations | ✅ In Progress |
| `pandas.ipynb`              | Pandas practice and data manipulation             | 🚧 Upcoming   |
| `matplotlib.ipynb`          | Data visualization using Matplotlib               | 🚧 Upcoming   |

---

## 🛠️ Technologies Used

![Python](https://img.shields.io/badge/Python-3.x-blue?logo=python\&logoColor=white)
![NumPy](https://img.shields.io/badge/NumPy-Numerical_Computing-4D77CF?logo=numpy\&logoColor=white)
![Pandas](https://img.shields.io/badge/Pandas-Data_Analysis-150458?logo=pandas\&logoColor=white)
![Matplotlib](https://img.shields.io/badge/Matplotlib-Visualization-orange)
![Jupyter](https://img.shields.io/badge/Jupyter-Notebook-F37626?logo=jupyter\&logoColor=white)

---

# 📚 What's Inside?

## 🐍 Python Bootcamp Assignment

The `bootcamp_assignment.ipynb` notebook contains exercises focused on strengthening basic Python programming concepts.

### Programs Covered

**1. Finding Even Numbers**

The program:

* Accepts numbers from the user
* Stores them inside a list
* Iterates through the list
* Identifies even numbers using the modulo operator

Concepts practiced:

`Lists` • `Loops` • `Input/Output` • `Conditional Statements`

**2. String Reversal**

The notebook also contains string manipulation exercises that:

* Reverse an entire string
* Split a sentence into words
* Reverse the order of words
* Join the words back together

Concepts practiced:

`Strings` • `Slicing` • `split()` • `join()` • `Lists`

---

## 🔢 NumPy Practice

The `numPy.ipynb` notebook contains exercises for understanding numerical computing and multidimensional arrays using **NumPy**.

### 1️⃣ NumPy Array & Square Calculation

A NumPy array containing numbers from **1 to 100** is generated using:

```python
np.arange()
```

The square of every element is then calculated using vectorized NumPy operations.

### 2️⃣ Cricket Runs Dataset 🏏

A small cricket dataset is generated using NumPy.

**Players:**

* Sachin
* Virat
* Rohit
* Yuvraj

**Matches:**

* IPL 2025
* IPL 2021
* IPL 2020

Random runs are generated for every player across different matches using:

```python
np.random.randint()
```

This exercise demonstrates:

`NumPy Arrays` • `Random Data Generation` • `2D Arrays`

---

## 👩‍💼 Employee Dataset

A random dataset for **10 employees** is generated containing:

| Feature       | Description                 |
| ------------- | --------------------------- |
| Age           | Employee age                |
| Sales         | Sales performance           |
| Working Hours | Number of working hours     |
| Performance   | Employee performance rating |

The different columns are combined into a dataset using:

```python
np.column_stack()
```

### 📊 Statistical Analysis

The **Sales** column is analyzed by calculating:

* 📈 Mean
* 📊 Median
* 🔁 Mode
* 📉 Standard Deviation

NumPy functions used include:

```python
np.mean()
np.median()
np.std()
np.unique()
```

This exercise demonstrates how NumPy can be used to generate and analyze a simple real-world-style dataset.

---

## 🧮 2D Array Analysis

A **4 × 4 NumPy array** is created to understand operations along different axes.

The following calculations are performed:

### Row-wise Average

```python
np.mean(arr, axis=1)
```

### Column-wise Average

```python
np.mean(arr, axis=0)
```

### Standard Deviation

```python
np.std(arr)
```

This helped me understand how the `axis` parameter works while performing calculations on multidimensional arrays.

---

## 🐼 Pandas

`pandas.ipynb`

This notebook is reserved for my upcoming Pandas practice.

Topics planned include:

* Creating DataFrames
* Reading datasets
* Selecting rows and columns
* Data cleaning
* Handling missing values
* Filtering data
* Statistical analysis
* Sorting and grouping data

---

## 📊 Matplotlib

`matplotlib.ipynb`

This notebook is reserved for data visualization practice using Matplotlib.

Topics planned include:

* Line plots
* Bar graphs
* Scatter plots
* Histograms
* Pie charts
* Labels and legends
* Plot customization

---

# 🧠 Concepts Practiced

Through this repository, I am working on:

```text
Python Fundamentals
       │
       ├── Lists
       ├── Loops
       ├── Conditional Statements
       ├── Strings
       │
       ▼
     NumPy
       │
       ├── Arrays
       ├── Random Data Generation
       ├── Multidimensional Arrays
       ├── Axis Operations
       └── Statistical Analysis
       │
       ▼
     Pandas
       │
       └── Data Analysis
       │
       ▼
   Matplotlib
       │
       └── Data Visualization
```

---

## 📂 Repository Structure

```text
Python-Learning/
│
├── bootcamp_assignment.ipynb
│   └── Python fundamentals & assignments
│
├── numPy.ipynb
│   └── NumPy arrays, datasets & statistics
│
├── pandas.ipynb
│   └── Pandas practice
│
├── matplotlib.ipynb
│   └── Data visualization practice
│
└── README.md
```

---

## 🎯 Learning Goals

The goal of this repository is to build a strong foundation in Python and gradually move toward **data analysis and machine learning**.

My learning path:

**Python → NumPy → Pandas → Matplotlib → Data Analysis → Machine Learning**

---

## 🚀 Future Updates

As I continue learning, I plan to add:

* More NumPy exercises
* Pandas data manipulation
* Data cleaning exercises
* Exploratory Data Analysis (EDA)
* Matplotlib visualizations
* Real-world datasets
* Mini data analysis projects
* Machine Learning basics

---

## 👩‍💻 Author

**Riddhi Mehrotra**

B.Tech Computer Science & Engineering Student

Currently exploring **Python, Data Analysis, Machine Learning and Cloud Technologies**.

---

### ⭐ Thanks for visiting!

This repository will continue to grow as I learn and experiment with new Python concepts.

If you find the repository useful, feel free to **star ⭐ the repository**.
